package com.safalifter.transformerservice.ingest;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.safalifter.transformerservice.entities.Controller;
import com.safalifter.transformerservice.entities.ControllerReading;
import com.safalifter.transformerservice.repository.ControllerReadingRepository;
import com.safalifter.transformerservice.repository.ControllerRepository;
import com.safalifter.transformerservice.repository.SensorReadingRepository;
import com.safalifter.transformerservice.repository.SensorRepository;
import com.safalifter.transformerservice.service.ControllerReadingService;
import com.safalifter.transformerservice.service.SensorReadingService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLParameters;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

@Component
@ConditionalOnProperty(prefix = "oculus.ws", name = "enabled", havingValue = "true", matchIfMissing = true)
@RequiredArgsConstructor
public class OculusWebSocketIngestor implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(OculusWebSocketIngestor.class);

    @Value("${oculus.ws.url:}")
    private String oculusWsUrlProp;

    private final SensorRepository sensorRepository;
    private final SensorReadingRepository sensorReadingRepository;
    private final SensorReadingService sensorReadingService;
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

    @Value("${oculus.ws.max-idle-seconds:300}")
    private long maxIdleSeconds;

    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2);

    private volatile Instant lastMessageAt = null;
    private volatile WebSocket activeSocket = null;
    private volatile Instant connectedAt = null;
    private final AtomicBoolean reconnectScheduled = new AtomicBoolean(false);
    private long reconnectCount = 0L;

    @Override
    public void run(ApplicationArguments args) {

        if (oculusWsUrlProp == null || oculusWsUrlProp.isBlank()) {
            log.info("Oculus WebSocket URL not configured");
            return;
        }

        // #region debug-point A:ws-config
        try {
            java.nio.file.Path dbgEnv = java.nio.file.Paths.get(".dbg", "live-loriot-offline.env");
            String debugServerUrl = "http://127.0.0.1:7777/event";
            String debugSessionId = "live-loriot-offline";
            if (java.nio.file.Files.exists(dbgEnv)) {
                for (String line : java.nio.file.Files.readAllLines(dbgEnv)) {
                    if (line.startsWith("DEBUG_SERVER_URL=")) debugServerUrl = line.substring("DEBUG_SERVER_URL=".length()).trim();
                    if (line.startsWith("DEBUG_SESSION_ID=")) debugSessionId = line.substring("DEBUG_SESSION_ID=".length()).trim();
                }
            }
            java.net.http.HttpClient.newHttpClient().send(
                    java.net.http.HttpRequest.newBuilder(java.net.URI.create(debugServerUrl))
                            .header("Content-Type", "application/json")
                            .POST(java.net.http.HttpRequest.BodyPublishers.ofString(
                                    objectMapper.writeValueAsString(java.util.Map.of(
                                            "sessionId", debugSessionId,
                                            "runId", "pre-fix",
                                            "hypothesisId", "A",
                                            "location", "OculusWebSocketIngestor:run",
                                            "msg", "[DEBUG] Oculus WebSocket startup config",
                                            "data", java.util.Map.of(
                                                    "urlConfigured", oculusWsUrlProp != null && !oculusWsUrlProp.isBlank(),
                                                    "urlHost", java.net.URI.create(oculusWsUrlProp).getHost(),
                                                    "insecureSsl", insecureSsl
                                            ),
                                            "ts", System.currentTimeMillis()
                                    ))
                            ))
                            .build(),
                    java.net.http.HttpResponse.BodyHandlers.discarding()
            );
        } catch (Exception ignored) {
        }
        // #endregion

        startLivenessWatchdog();
        connect();
    }

    private void startLivenessWatchdog() {
        long period = Math.max(5L, livenessCheckSeconds);
        scheduler.scheduleAtFixedRate(() -> {
            try {
                evaluateLiveness();
            } catch (Exception t) {
                log.warn("Oculus WS liveness checker exception", t);
            }
        }, period, period, TimeUnit.SECONDS);
        log.info("Oculus WS liveness watchdog started (checkEvery={}s maxIdle={}s)", period, maxIdleSeconds);
    }

    private synchronized void evaluateLiveness() {
        WebSocket ws = activeSocket;
        boolean socketOpen = ws != null && !ws.isInputClosed() && !ws.isOutputClosed();
        boolean socketPresent = ws != null;

        Instant now = Instant.now();
        Long idleSeconds = null;
        if (lastMessageAt != null) {
            idleSeconds = Duration.between(lastMessageAt, now).getSeconds();
        } else if (connectedAt != null) {
            idleSeconds = Duration.between(connectedAt, now).getSeconds();
        }

        boolean stale = idleSeconds != null && idleSeconds > Math.max(30L, maxIdleSeconds);
        boolean needsReconnect = !socketPresent || !socketOpen || stale;

        if (needsReconnect) {
            String reason = !socketPresent ? "no-active-socket"
                    : (!socketOpen ? "socket-closed" : "idle-stale-" + idleSeconds + "s");
            log.warn("Oculus WS liveness check: triggering reconnect (reason={}, open={}, lastMsg={}s ago)",
                    reason, socketOpen, idleSeconds);
            safeReconnect();
        } else {
            if (log.isDebugEnabled()) {
                log.debug("Oculus WS liveness OK: open={}, lastMsg={}s ago", socketOpen, idleSeconds);
            }
        }
    }

    private void safeReconnect() {
        if (reconnectScheduled.compareAndSet(false, true)) {
            try {
                reconnectCount++;
                WebSocket stale = activeSocket;
                if (stale != null) {
                    try {
                        stale.abort();
                    } catch (Exception ignored) {
                    }
                }
                activeSocket = null;
            } catch (Exception ignored) {
            }
            reconnect();
        } else {
            log.debug("Oculus WS reconnect already scheduled; skipping");
        }
    }

    private void connect() {

        try {
            HttpClient client = buildHttpClient();

            // #region debug-point B:ws-connect-attempt
            try {
                java.nio.file.Path dbgEnv = java.nio.file.Paths.get(".dbg", "live-loriot-offline.env");
                String debugServerUrl = "http://127.0.0.1:7777/event";
                String debugSessionId = "live-loriot-offline";
                if (java.nio.file.Files.exists(dbgEnv)) {
                    for (String line : java.nio.file.Files.readAllLines(dbgEnv)) {
                        if (line.startsWith("DEBUG_SERVER_URL=")) debugServerUrl = line.substring("DEBUG_SERVER_URL=".length()).trim();
                        if (line.startsWith("DEBUG_SESSION_ID=")) debugSessionId = line.substring("DEBUG_SESSION_ID=".length()).trim();
                    }
                }
                java.net.http.HttpClient.newHttpClient().send(
                        java.net.http.HttpRequest.newBuilder(java.net.URI.create(debugServerUrl))
                                .header("Content-Type", "application/json")
                                .POST(java.net.http.HttpRequest.BodyPublishers.ofString(
                                        objectMapper.writeValueAsString(java.util.Map.of(
                                                "sessionId", debugSessionId,
                                                "runId", "pre-fix",
                                                "hypothesisId", "B",
                                                "location", "OculusWebSocketIngestor:connect",
                                                "msg", "[DEBUG] Attempting Oculus WebSocket connect",
                                                "data", java.util.Map.of(
                                                        "insecureSsl", insecureSsl,
                                                        "urlHost", java.net.URI.create(oculusWsUrlProp).getHost()
                                                ),
                                                "ts", System.currentTimeMillis()
                                        ))
                                ))
                                .build(),
                        java.net.http.HttpResponse.BodyHandlers.discarding()
                );
            } catch (Exception ignored) {
            }
            // #endregion

            client.newWebSocketBuilder()
                    .buildAsync(URI.create(oculusWsUrlProp), new Listener())
                    .thenAccept(ws -> {
                        log.info("Connected to Oculus WebSocket");
                        activeSocket = ws;
                        connectedAt = Instant.now();
                        if (lastMessageAt == null) lastMessageAt = connectedAt;
                        reconnectScheduled.set(false);
                        // #region debug-point B:ws-connect-success
                        try {
                            java.nio.file.Path dbgEnv = java.nio.file.Paths.get(".dbg", "live-loriot-offline.env");
                            String debugServerUrl = "http://127.0.0.1:7777/event";
                            String debugSessionId = "live-loriot-offline";
                            if (java.nio.file.Files.exists(dbgEnv)) {
                                for (String line : java.nio.file.Files.readAllLines(dbgEnv)) {
                                    if (line.startsWith("DEBUG_SERVER_URL=")) debugServerUrl = line.substring("DEBUG_SERVER_URL=".length()).trim();
                                    if (line.startsWith("DEBUG_SESSION_ID=")) debugSessionId = line.substring("DEBUG_SESSION_ID=".length()).trim();
                                }
                            }
                            java.net.http.HttpClient.newHttpClient().send(
                                    java.net.http.HttpRequest.newBuilder(java.net.URI.create(debugServerUrl))
                                            .header("Content-Type", "application/json")
                                            .POST(java.net.http.HttpRequest.BodyPublishers.ofString(
                                                    objectMapper.writeValueAsString(java.util.Map.of(
                                                            "sessionId", debugSessionId,
                                                            "runId", "pre-fix",
                                                            "hypothesisId", "B",
                                                            "location", "OculusWebSocketIngestor:connect",
                                                            "msg", "[DEBUG] Oculus WebSocket connected",
                                                            "data", java.util.Map.of("urlHost", java.net.URI.create(oculusWsUrlProp).getHost()),
                                                            "ts", System.currentTimeMillis()
                                                    ))
                                            ))
                                            .build(),
                                    java.net.http.HttpResponse.BodyHandlers.discarding()
                            );
                        } catch (Exception ignored) {
                        }
                        // #endregion
                    })
                    .exceptionally(ex -> {
                        reconnectScheduled.set(false);
                        // #region debug-point B:ws-connect-failed
                        try {
                            java.nio.file.Path dbgEnv = java.nio.file.Paths.get(".dbg", "live-loriot-offline.env");
                            String debugServerUrl = "http://127.0.0.1:7777/event";
                            String debugSessionId = "live-loriot-offline";
                            if (java.nio.file.Files.exists(dbgEnv)) {
                                for (String line : java.nio.file.Files.readAllLines(dbgEnv)) {
                                    if (line.startsWith("DEBUG_SERVER_URL=")) debugServerUrl = line.substring("DEBUG_SERVER_URL=".length()).trim();
                                    if (line.startsWith("DEBUG_SESSION_ID=")) debugSessionId = line.substring("DEBUG_SESSION_ID=".length()).trim();
                                }
                            }
                            Throwable root = ex;
                            while (root.getCause() != null) root = root.getCause();
                            java.net.http.HttpClient.newHttpClient().send(
                                    java.net.http.HttpRequest.newBuilder(java.net.URI.create(debugServerUrl))
                                            .header("Content-Type", "application/json")
                                            .POST(java.net.http.HttpRequest.BodyPublishers.ofString(
                                                    objectMapper.writeValueAsString(java.util.Map.of(
                                                            "sessionId", debugSessionId,
                                                            "runId", "pre-fix",
                                                            "hypothesisId", "B",
                                                            "location", "OculusWebSocketIngestor:connect",
                                                            "msg", "[DEBUG] Oculus WebSocket connect failed",
                                                            "data", java.util.Map.of(
                                                                    "error", String.valueOf(root),
                                                                    "errorType", root.getClass().getName()
                                                            ),
                                                            "ts", System.currentTimeMillis()
                                                    ))
                                            ))
                                            .build(),
                                    java.net.http.HttpResponse.BodyHandlers.discarding()
                            );
                        } catch (Exception ignored) {
                        }
                        // #endregion
                        log.error("WebSocket connection failed", ex);
                        safeReconnect();
                        return null;
                    });

        } catch (Exception e) {

            log.error("WebSocket start error", e);
            safeReconnect();

        }
    }

    private void reconnect() {

        scheduler.schedule(() -> {
            log.info("Reconnecting Oculus WebSocket (attempt #{})...", reconnectCount);
            try {
                connect();
            } catch (Exception e) {
                log.error("Reconnect attempt error", e);
                reconnectScheduled.set(false);
            }

        }, 10, TimeUnit.SECONDS);

    }

    private class Listener implements WebSocket.Listener {

        @Override
        public void onOpen(WebSocket webSocket) {
            WebSocket.Listener.super.onOpen(webSocket);
            activeSocket = webSocket;
            connectedAt = Instant.now();
            if (lastMessageAt == null) lastMessageAt = connectedAt;
            reconnectScheduled.set(false);
            log.info("Oculus WS session opened");
            webSocket.request(1);
        }

        @Override
        public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {

            lastMessageAt = Instant.now();

            try {

                String message = data.toString();

                if (logWs) log.info("WS {}", message);

                // #region debug-point D:ws-message
                try {
                    java.nio.file.Path dbgEnv = java.nio.file.Paths.get(".dbg", "live-loriot-offline.env");
                    String debugServerUrl = "http://127.0.0.1:7777/event";
                    String debugSessionId = "live-loriot-offline";
                    if (java.nio.file.Files.exists(dbgEnv)) {
                        for (String line : java.nio.file.Files.readAllLines(dbgEnv)) {
                            if (line.startsWith("DEBUG_SERVER_URL=")) debugServerUrl = line.substring("DEBUG_SERVER_URL=".length()).trim();
                            if (line.startsWith("DEBUG_SESSION_ID=")) debugSessionId = line.substring("DEBUG_SESSION_ID=".length()).trim();
                        }
                    }
                    JsonNode root = objectMapper.readTree(message);
                    java.net.http.HttpClient.newHttpClient().send(
                            java.net.http.HttpRequest.newBuilder(java.net.URI.create(debugServerUrl))
                                    .header("Content-Type", "application/json")
                                    .POST(java.net.http.HttpRequest.BodyPublishers.ofString(
                                            objectMapper.writeValueAsString(java.util.Map.of(
                                                    "sessionId", debugSessionId,
                                                    "runId", "pre-fix",
                                                    "hypothesisId", "D",
                                                    "location", "OculusWebSocketIngestor:onText",
                                                    "msg", "[DEBUG] Oculus WebSocket message received",
                                                    "data", java.util.Map.of(
                                                            "cmd", root.path("cmd").asText(),
                                                            "eui", root.path("EUI").asText(),
                                                            "seqno", root.path("seqno").asLong(),
                                                            "hasData", root.has("data")
                                                    ),
                                                    "ts", System.currentTimeMillis()
                                            ))
                                    ))
                                    .build(),
                            java.net.http.HttpResponse.BodyHandlers.discarding()
                    );
                } catch (Exception ignored) {
                }
                // #endregion

                processMessage(message);

            } catch (Exception e) {

                log.error("WS processing error", e);

            }

            return WebSocket.Listener.super.onText(webSocket, data, last);
        }

        @Override
        public void onError(WebSocket webSocket, Throwable error) {
            log.error("Oculus WebSocket error", error);
            safeReconnect();

        }

        @Override
        public CompletionStage<?> onClose(WebSocket webSocket, int statusCode, String reason) {

            log.warn("Oculus WebSocket closed code={} reason={}", statusCode, reason);
            safeReconnect();

            return WebSocket.Listener.super.onClose(webSocket, statusCode, reason);
        }
    }

    private HttpClient buildHttpClient() throws Exception {
        if (!insecureSsl) {
            return HttpClient.newHttpClient();
        }

        SSLContext sslContext = buildTrustAllSslContext();
        SSLParameters sslParameters = new SSLParameters();
        sslParameters.setEndpointIdentificationAlgorithm("");

        return HttpClient.newBuilder()
                .sslContext(sslContext)
                .sslParameters(sslParameters)
                .build();
    }

    private SSLContext buildTrustAllSslContext() throws Exception {
        TrustManager[] trustAllManagers = new TrustManager[]{
                new X509TrustManager() {
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
                }
        };

        SSLContext sslContext = SSLContext.getInstance("TLS");
        sslContext.init(null, trustAllManagers, new SecureRandom());
        return sslContext;
    }

    private void processMessage(String payload) {

        try {

            JsonNode root = objectMapper.readTree(payload);

            String cmd = root.path("cmd").asText();

            if (!"gw".equals(cmd)) return;

            if (!root.has("data")) return;

            String devEui = root.path("EUI").asText();
            String dataHex = root.path("data").asText();
            int port = root.path("port").asInt(2);

            Optional<Controller> controllerOpt = controllerRepository.findByDevEuiAndSupplierCode(devEui, "oculus");

            Controller controller = controllerOpt.orElseGet(() -> {

                Controller c = Controller.builder()
                        .devEui(devEui)
                        .deviceId(devEui)
                        .name("Controller " + devEui)
                        .type("DRAGINO_LT22222")
                        .supplierCode("oculus")
                        .supplierName("Oculus")
                        .build();

                return controllerRepository.save(c);

            });

            byte[] bytes = HexFormat.of().parseHex(dataHex);

            Map<String, Object> decoded = decodeUplinkDragino(bytes, port);

            log.info("Decoded {}", decoded);

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

        } catch (Exception e) {

            log.error("Message parse error", e);

        }

    }

    /**
     * DRAGINO LT22222 DECODER
     */
    private Map<String, Object> decodeUplinkDragino(byte[] bytes, int fPort) {

        Map<String, Object> result = new HashMap<>();

        if (bytes == null || bytes.length < 11) return result;

        int hardware = (bytes[10] & 0xC0) >> 6;
        int mode = bytes[10] & 0x3F;

        result.put("hardware", hardware == 1 ? "LT22222" : "UNKNOWN");
        result.put("mode", mode);

        int io = bytes[8] & 0xFF;

        boolean di1 = (io & 0x08) != 0;
        boolean di2 = (io & 0x10) != 0;

        boolean do1 = (io & 0x01) != 0;
        boolean do2 = (io & 0x02) != 0;

        boolean ro1 = (io & 0x80) != 0;
        boolean ro2 = (io & 0x40) != 0;

        result.put("DI1", di1);
        result.put("DI2", di2);
        result.put("DO1", do1);
        result.put("DO2", do2);
        result.put("RO1", ro1);
        result.put("RO2", ro2);

        if (mode == 1) {

            result.put("mode_name", "Analog Mode");

            float avi1 = ((bytes[0] & 0xff) << 8 | (bytes[1] & 0xff)) / 1000f;
            float avi2 = ((bytes[2] & 0xff) << 8 | (bytes[3] & 0xff)) / 1000f;

            float aci1 = ((bytes[4] & 0xff) << 8 | (bytes[5] & 0xff)) / 1000f;
            float aci2 = ((bytes[6] & 0xff) << 8 | (bytes[7] & 0xff)) / 1000f;

            result.put("AVI1_voltage", avi1);
            result.put("AVI2_voltage", avi2);
            result.put("ACI1_current", aci1);
            result.put("ACI2_current", aci2);

        }

        if (mode == 6) {

            result.put("mode_name", "Exit Mode");

            int alarm = bytes[2] & 0xff;

            boolean exitDI1 = (alarm & 0x02) != 0;
            boolean exitDI2 = (alarm & 0x08) != 0;

            result.put("DI1", exitDI1);
            result.put("DI2", exitDI2);

        }

        return result;

    }

    public Map<String, Object> getStatusSnapshot() {
        Map<String, Object> m = new LinkedHashMap<>();
        WebSocket ws = activeSocket;
        boolean open = ws != null && !ws.isInputClosed() && !ws.isOutputClosed();
        m.put("supplier", "oculus");
        m.put("enabled", true);
        m.put("urlConfigured", oculusWsUrlProp != null && !oculusWsUrlProp.isBlank());
        m.put("connected", open);
        m.put("socketPresent", ws != null);
        m.put("connectedAt", connectedAt == null ? null : connectedAt.toString());
        m.put("lastMessageAt", lastMessageAt == null ? null : lastMessageAt.toString());
        Long idleSec = null;
        if (lastMessageAt != null) {
            idleSec = Duration.between(lastMessageAt, Instant.now()).getSeconds();
        }
        m.put("idleSeconds", idleSec);
        m.put("maxIdleSeconds", Math.max(30L, maxIdleSeconds));
        m.put("livenessCheckSeconds", Math.max(5L, livenessCheckSeconds));
        m.put("reconnectCount", reconnectCount);
        m.put("reconnectScheduled", reconnectScheduled.get());
        return m;
    }

}
