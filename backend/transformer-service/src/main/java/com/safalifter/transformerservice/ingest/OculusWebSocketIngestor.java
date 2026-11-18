package com.safalifter.transformerservice.ingest;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.safalifter.transformerservice.entities.Controller;
import com.safalifter.transformerservice.entities.ControllerReading;
import com.safalifter.transformerservice.repository.ControllerReadingRepository;
import com.safalifter.transformerservice.repository.ControllerRepository;
import com.safalifter.transformerservice.service.ControllerReadingService;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLParameters;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.nio.ByteBuffer;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Oqulus / Oculus devices: uplinks arrive on the LORIOT application WebSocket.
 *
 * <p>Hardened so the feed can never stop silently:
 * <ul>
 *   <li>Both "rx" and "gw" messages are accepted (LORIOT sends "gw" only while the app output has gateway info
 *       switched on); the same uplink arriving as both is stored once (EUI + seqno / fcnt).</li>
 *   <li>Watchdog: reconnects when the socket is closed, when no message at all arrived for {@code max-idle-seconds},
 *       or when no uplink was stored for {@code max-uplink-idle-seconds} (default 10 minutes).</li>
 *   <li>A WebSocket ping every 60 s keeps NAT / proxies from silently dropping an idle connection.</li>
 *   <li>Messages are stored on a separate worker thread, so a slow database never stalls the socket;
 *       fragmented frames are joined before parsing.</li>
 *   <li>{@link #getStatusSnapshot()} reports connection, last message, last stored uplink, counters per message
 *       type and the last error (GET /api/v1/ws-ingest/status).</li>
 * </ul>
 */
@Component
@ConditionalOnProperty(prefix = "oculus.ws", name = "enabled", havingValue = "true", matchIfMissing = true)
@RequiredArgsConstructor
public class OculusWebSocketIngestor implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(OculusWebSocketIngestor.class);
    private static final int DEDUPE_SIZE = 20_000;

    @Value("${oculus.ws.url:}")
    private String oculusWsUrlProp;

    private final ControllerRepository controllerRepository;
    private final ControllerReadingRepository controllerReadingRepository;
    private final ControllerReadingService controllerReadingService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${oculus.ws.log:false}")
    private boolean logWs;

    @Value("${oculus.ws.insecure-ssl:false}")
    private boolean insecureSsl;

    @Value("${oculus.ws.liveness-check-seconds:30}")
    private long livenessCheckSeconds;

    /** No message of any kind for this long: the socket is treated as dead and reopened. */
    @Value("${oculus.ws.max-idle-seconds:300}")
    private long maxIdleSeconds;

    /** No uplink stored for this long: reconnect (catches a socket that only receives non-uplink traffic). */
    @Value("${oculus.ws.max-uplink-idle-seconds:600}")
    private long maxUplinkIdleSeconds;

    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2, r -> {
        Thread t = new Thread(r, "oculus-ws-watchdog");
        t.setDaemon(true);
        return t;
    });

    /** One worker keeps uplinks in order; the queue absorbs bursts while the database is slow. */
    private final ThreadPoolExecutor worker = new ThreadPoolExecutor(1, 1, 0L, TimeUnit.MILLISECONDS,
            new LinkedBlockingQueue<>(50_000), r -> {
                Thread t = new Thread(r, "oculus-ws-ingest");
                t.setDaemon(true);
                return t;
            }, new ThreadPoolExecutor.DiscardOldestPolicy());

    private volatile HttpClient httpClient;
    private volatile WebSocket activeSocket;
    private volatile Instant connectedAt;
    private volatile Instant lastMessageAt;
    private volatile Instant lastUplinkAt;
    private volatile String lastUplinkEui;
    private volatile Instant lastReconnectAt;
    private volatile String lastReconnectReason;
    private volatile String lastError;
    private volatile Instant lastErrorAt;
    private volatile String lastClose;
    private final Instant startedAt = Instant.now();

    private final AtomicBoolean reconnectScheduled = new AtomicBoolean(false);
    private final AtomicLong reconnectCount = new AtomicLong();
    private final AtomicLong messages = new AtomicLong();
    private final AtomicLong uplinksStored = new AtomicLong();
    private final AtomicLong duplicatesSkipped = new AtomicLong();
    private final AtomicLong processingErrors = new AtomicLong();
    private final Map<String, AtomicLong> byCommand = new ConcurrentHashMap<>();

    /** Recently stored uplinks (EUI:seqno) so the rx + gw copies of one uplink are stored once. */
    private final Map<String, Boolean> recent = java.util.Collections.synchronizedMap(new LinkedHashMap<>(1024, 0.75f, false) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, Boolean> eldest) {
            return size() > DEDUPE_SIZE;
        }
    });

    @Override
    public void run(ApplicationArguments args) {
        if (oculusWsUrlProp == null || oculusWsUrlProp.isBlank()) {
            log.info("Oculus WebSocket URL not configured");
            return;
        }
        long period = Math.max(5L, livenessCheckSeconds);
        scheduler.scheduleAtFixedRate(this::safeCheck, period, period, TimeUnit.SECONDS);
        scheduler.scheduleAtFixedRate(this::ping, 60, 60, TimeUnit.SECONDS);
        log.info("Oculus WS watchdog started (check every {}s, reconnect after {}s without messages or {}s without uplinks)",
                period, Math.max(30L, maxIdleSeconds), Math.max(60L, maxUplinkIdleSeconds));
        connect();
    }

    @PreDestroy
    void shutdown() {
        scheduler.shutdownNow();
        worker.shutdown();
        WebSocket ws = activeSocket;
        if (ws != null) {
            try {
                ws.abort();
            } catch (Exception ignored) {
            }
        }
    }

    // ------------------------------------------------------------------ connection

    private void connect() {
        try {
            if (httpClient == null) httpClient = buildHttpClient();
            httpClient.newWebSocketBuilder()
                    .connectTimeout(Duration.ofSeconds(20))
                    .buildAsync(URI.create(oculusWsUrlProp), new Listener())
                    .whenComplete((ws, ex) -> {
                        if (ex != null) {
                            recordError("connect failed: " + rootMessage(ex));
                            log.error("Oculus WebSocket connect failed: {}", rootMessage(ex));
                            reconnectScheduled.set(false);
                            scheduleReconnect("connect-failed");
                        } else {
                            log.info("Connected to Oculus WebSocket");
                        }
                    });
        } catch (Exception e) {
            recordError("start error: " + rootMessage(e));
            log.error("Oculus WebSocket start error", e);
            reconnectScheduled.set(false);
            scheduleReconnect("start-error");
        }
    }

    /** Close whatever socket we have and open a new one after 10 s (one reconnect at a time). */
    private void scheduleReconnect(String reason) {
        if (!reconnectScheduled.compareAndSet(false, true)) {
            log.debug("Oculus WS reconnect already scheduled ({})", reason);
            return;
        }
        reconnectCount.incrementAndGet();
        lastReconnectAt = Instant.now();
        lastReconnectReason = reason;
        WebSocket stale = activeSocket;
        activeSocket = null;
        if (stale != null) {
            try {
                stale.abort();
            } catch (Exception ignored) {
            }
        }
        log.warn("Oculus WS reconnecting in 10s (reason={}, attempt #{})", reason, reconnectCount.get());
        try {
            scheduler.schedule(() -> {
                reconnectScheduled.set(false);
                connect();
            }, 10, TimeUnit.SECONDS);
        } catch (Exception e) {
            reconnectScheduled.set(false);
        }
    }

    private void safeCheck() {
        try {
            checkLiveness();
        } catch (Exception e) {
            log.warn("Oculus WS watchdog error", e);
        }
    }

    private void checkLiveness() {
        if (reconnectScheduled.get()) return;
        WebSocket ws = activeSocket;
        Instant now = Instant.now();
        if (ws == null || ws.isInputClosed() || ws.isOutputClosed()) {
            // Still connecting for the first time: give it a minute before forcing another attempt.
            Instant since = lastReconnectAt != null ? lastReconnectAt : startedAt;
            if (Duration.between(since, now).getSeconds() > 60) scheduleReconnect(ws == null ? "no-socket" : "socket-closed");
            return;
        }
        Instant opened = connectedAt != null ? connectedAt : now;
        long msgIdle = secondsSince(later(lastMessageAt, opened), now);
        if (msgIdle > Math.max(30L, maxIdleSeconds)) {
            scheduleReconnect("no-messages-" + msgIdle + "s");
            return;
        }
        long upIdle = secondsSince(later(lastUplinkAt, opened), now);
        if (upIdle > Math.max(60L, maxUplinkIdleSeconds)) {
            scheduleReconnect("no-uplinks-" + upIdle + "s");
        }
    }

    private void ping() {
        WebSocket ws = activeSocket;
        if (ws == null || ws.isOutputClosed()) return;
        try {
            ws.sendPing(ByteBuffer.wrap(new byte[]{'t', 'i', 'a', 's'}));
        } catch (Exception e) {
            log.debug("Oculus WS ping failed: {}", e.getMessage());
        }
    }

    private class Listener implements WebSocket.Listener {
        private final StringBuilder buffer = new StringBuilder();

        @Override
        public void onOpen(WebSocket webSocket) {
            activeSocket = webSocket;
            connectedAt = Instant.now();
            reconnectScheduled.set(false);
            log.info("Oculus WebSocket open");
            webSocket.request(1);
        }

        @Override
        public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {
            buffer.append(data);
            if (last) {
                String message = buffer.toString();
                buffer.setLength(0);
                lastMessageAt = Instant.now();
                messages.incrementAndGet();
                if (logWs) log.info("WS {}", message);
                worker.execute(() -> processMessage(message));
            }
            webSocket.request(1);
            return null;
        }

        @Override
        public CompletionStage<?> onPong(WebSocket webSocket, ByteBuffer message) {
            webSocket.request(1);
            return null;
        }

        @Override
        public CompletionStage<?> onPing(WebSocket webSocket, ByteBuffer message) {
            // The JDK answers pings with a pong automatically.
            webSocket.request(1);
            return null;
        }

        @Override
        public void onError(WebSocket webSocket, Throwable error) {
            recordError("socket error: " + rootMessage(error));
            log.error("Oculus WebSocket error: {}", rootMessage(error));
            if (webSocket == activeSocket || activeSocket == null) scheduleReconnect("socket-error");
        }

        @Override
        public CompletionStage<?> onClose(WebSocket webSocket, int statusCode, String reason) {
            lastClose = statusCode + (reason == null || reason.isBlank() ? "" : " " + reason) + " at " + Instant.now();
            log.warn("Oculus WebSocket closed code={} reason={}", statusCode, reason);
            if (webSocket == activeSocket || activeSocket == null) scheduleReconnect("closed-" + statusCode);
            return CompletableFuture.completedFuture(null);
        }
    }

    // ------------------------------------------------------------------ messages

    private void processMessage(String payload) {
        try {
            JsonNode root = objectMapper.readTree(payload);
            String cmd = root.path("cmd").asText("");
            byCommand.computeIfAbsent(cmd.isBlank() ? "(none)" : cmd, k -> new AtomicLong()).incrementAndGet();

            // Uplinks: "gw" (with gateway info) or "rx" (without). Everything else (acks, tx confirmations) is ignored.
            if (!"gw".equals(cmd) && !"rx".equals(cmd)) return;
            String dataHex = root.path("data").asText("");
            if (dataHex.isBlank()) return;

            String devEui = root.path("EUI").asText("");
            if (devEui.isBlank()) return;
            String key = devEui.toUpperCase(java.util.Locale.ROOT) + ":"
                    + (root.hasNonNull("seqno") ? "s" + root.path("seqno").asText() : "f" + root.path("fcnt").asText() + "@" + root.path("ts").asText());
            if (recent.putIfAbsent(key, Boolean.TRUE) != null) {
                duplicatesSkipped.incrementAndGet();
                return;
            }

            int port = root.path("port").asInt(2);

            Optional<Controller> controllerOpt = controllerRepository.findByDevEuiAndSupplierCode(devEui, "oculus");
            Controller controller = controllerOpt.orElseGet(() -> controllerRepository.save(Controller.builder()
                    .devEui(devEui)
                    .deviceId(devEui)
                    .name("Controller " + devEui)
                    .type("DRAGINO_LT22222")
                    .supplierCode("oculus")
                    .supplierName("Oculus")
                    .build()));

            byte[] bytes = HexFormat.of().parseHex(dataHex);
            Map<String, Object> decoded = decodeUplinkDragino(bytes, port);
            if (log.isDebugEnabled()) log.debug("Decoded {} {}", devEui, decoded);

            boolean di1 = Boolean.TRUE.equals(decoded.get("DI1"));
            boolean di2 = Boolean.TRUE.equals(decoded.get("DI2"));
            int battery = root.path("bat").asInt();
            int rssi = root.path("rssi").asInt(0);
            int snr = root.path("snr").asInt(0);
            if (root.has("gws") && root.path("gws").isArray() && root.path("gws").size() > 0) {
                JsonNode gw0 = root.path("gws").get(0);
                rssi = gw0.path("rssi").asInt(rssi);
                snr = gw0.path("snr").asInt(snr);
            }

            ControllerReading reading = ControllerReading.builder()
                    .controllerId(controller.getId())
                    .rawPayload(payload)
                    .decodedPayload(objectMapper.writeValueAsString(decoded))
                    .di1(di1)
                    .di2(di2)
                    .battery(battery)
                    .rssi(rssi)
                    .snr(snr)
                    .build();

            controllerReadingService.save(reading);
            uplinksStored.incrementAndGet();
            lastUplinkAt = Instant.now();
            lastUplinkEui = devEui;
        } catch (Exception e) {
            processingErrors.incrementAndGet();
            recordError("processing: " + rootMessage(e));
            log.error("Oculus message processing error", e);
        }
    }

    /** DRAGINO LT22222 decoder (single source of truth shared with the supplier integration framework). */
    private Map<String, Object> decodeUplinkDragino(byte[] bytes, int fPort) {
        return com.safalifter.transformerservice.ingest.framework.DraginoLt22222Decoder.decodeBytes(bytes, fPort);
    }

    // ------------------------------------------------------------------ status

    public Map<String, Object> getStatusSnapshot() {
        Map<String, Object> m = new LinkedHashMap<>();
        WebSocket ws = activeSocket;
        boolean open = ws != null && !ws.isInputClosed() && !ws.isOutputClosed();
        Instant now = Instant.now();
        Long uplinkIdle = lastUplinkAt == null ? null : secondsSince(lastUplinkAt, now);
        m.put("supplier", "oculus");
        m.put("enabled", true);
        m.put("urlConfigured", oculusWsUrlProp != null && !oculusWsUrlProp.isBlank());
        m.put("connected", open);
        m.put("socketPresent", ws != null);
        m.put("healthy", open && uplinkIdle != null && uplinkIdle <= Math.max(60L, maxUplinkIdleSeconds));
        m.put("startedAt", startedAt.toString());
        m.put("connectedAt", str(connectedAt));
        m.put("lastMessageAt", str(lastMessageAt));
        m.put("idleSeconds", lastMessageAt == null ? null : secondsSince(lastMessageAt, now));
        m.put("lastUplinkAt", str(lastUplinkAt));
        m.put("lastUplinkEui", lastUplinkEui);
        m.put("uplinkIdleSeconds", uplinkIdle);
        m.put("messagesReceived", messages.get());
        m.put("uplinksStored", uplinksStored.get());
        m.put("duplicatesSkipped", duplicatesSkipped.get());
        m.put("processingErrors", processingErrors.get());
        m.put("messagesByType", byCommand.entrySet().stream()
                .collect(java.util.stream.Collectors.toMap(Map.Entry::getKey, e -> e.getValue().get())));
        m.put("queueSize", worker.getQueue().size());
        m.put("maxIdleSeconds", Math.max(30L, maxIdleSeconds));
        m.put("maxUplinkIdleSeconds", Math.max(60L, maxUplinkIdleSeconds));
        m.put("livenessCheckSeconds", Math.max(5L, livenessCheckSeconds));
        m.put("reconnectCount", reconnectCount.get());
        m.put("reconnectScheduled", reconnectScheduled.get());
        m.put("lastReconnectAt", str(lastReconnectAt));
        m.put("lastReconnectReason", lastReconnectReason);
        m.put("lastClose", lastClose);
        m.put("lastError", lastError);
        m.put("lastErrorAt", str(lastErrorAt));
        return m;
    }

    // ------------------------------------------------------------------ helpers

    private void recordError(String message) {
        lastError = message;
        lastErrorAt = Instant.now();
    }

    private static String str(Instant i) {
        return i == null ? null : i.toString();
    }

    private static Instant later(Instant a, Instant b) {
        if (a == null) return b;
        if (b == null) return a;
        return a.isAfter(b) ? a : b;
    }

    private static long secondsSince(Instant from, Instant now) {
        return from == null ? 0L : Math.max(0L, Duration.between(from, now).getSeconds());
    }

    private static String rootMessage(Throwable t) {
        Throwable c = t;
        while (c.getCause() != null && c.getCause() != c) c = c.getCause();
        String m = c.getMessage();
        return c.getClass().getSimpleName() + (m == null ? "" : ": " + m);
    }

    private HttpClient buildHttpClient() throws Exception {
        if (!insecureSsl) {
            return HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(20)).build();
        }
        SSLContext sslContext = SSLContext.getInstance("TLS");
        sslContext.init(null, new TrustManager[]{new X509TrustManager() {
            @Override
            public void checkClientTrusted(X509Certificate[] chain, String authType) {
            }

            @Override
            public void checkServerTrusted(X509Certificate[] chain, String authType) {
            }

            @Override
            public X509Certificate[] getAcceptedIssuers() {
                return new X509Certificate[0];
            }
        }}, new SecureRandom());
        SSLParameters sslParameters = new SSLParameters();
        sslParameters.setEndpointIdentificationAlgorithm("");
        return HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(20))
                .sslContext(sslContext)
                .sslParameters(sslParameters)
                .build();
    }
}
