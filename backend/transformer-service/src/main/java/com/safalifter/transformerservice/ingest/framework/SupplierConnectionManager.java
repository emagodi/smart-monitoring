package com.safalifter.transformerservice.ingest.framework;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.safalifter.transformerservice.entities.SupplierIntegration;
import com.safalifter.transformerservice.repository.SupplierIntegrationRepository;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Keeps one LORIOT application websocket open per enabled LORIOT_WEBSOCKET supplier integration.
 * Every 30 s it reconciles: opens new/changed feeds, closes disabled ones, and reconnects feeds
 * that went silent. Messages are handed to {@link TelemetryPipeline}.
 *
 * Adding a partner = add a row on the Integrations screen (URL + decoder). No code change.
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class SupplierConnectionManager {

    private final SupplierIntegrationRepository integrationRepository;
    private final TelemetryPipeline pipeline;
    private final NamedParameterJdbcTemplate jdbc;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /** Legacy env-configured Oculus feed; if set, a framework "oculus" feed is not opened (no double ingestion). */
    @Value("${oculus.ws.url:}")
    private String legacyOculusUrl;

    @Value("${integrations.ws.max-idle-seconds:600}")
    private long maxIdleSeconds = 600;

    @Value("${integrations.enabled:true}")
    private boolean enabled = true;

    private final Map<Long, Feed> feeds = new ConcurrentHashMap<>();
    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(20)).build();

    private final class Feed {
        final Long id;
        final String url;
        volatile WebSocket socket;
        volatile Instant lastMessage = Instant.now();
        volatile boolean connecting;
        final StringBuilder partial = new StringBuilder();

        Feed(Long id, String url) {
            this.id = id;
            this.url = url;
        }
    }

    @Scheduled(initialDelay = 20_000, fixedDelay = 30_000)
    public void reconcile() {
        if (!enabled) return;
        List<SupplierIntegration> wanted;
        try {
            wanted = integrationRepository.findAllByEnabledTrueAndTransport("LORIOT_WEBSOCKET");
        } catch (Exception e) {
            log.debug("Integrations table not ready: {}", e.getMessage());
            return;
        }
        Set<Long> wantedIds = wanted.stream().map(SupplierIntegration::getId).collect(Collectors.toSet());

        // close feeds that were disabled or deleted
        feeds.keySet().stream().filter(id -> !wantedIds.contains(id)).toList().forEach(this::close);

        for (SupplierIntegration integ : wanted) {
            if ("oculus".equalsIgnoreCase(integ.getSupplierCode()) && legacyOculusUrl != null && !legacyOculusUrl.isBlank()) {
                status(integ.getId(), "SKIPPED_LEGACY", "Legacy OCULUS_WS_URL is active; clear it to let this feed take over");
                continue;
            }
            if (integ.getEndpointUrl() == null || integ.getEndpointUrl().isBlank()) {
                status(integ.getId(), "MISCONFIGURED", "No websocket URL");
                continue;
            }
            Feed feed = feeds.get(integ.getId());
            if (feed != null && !Objects.equals(feed.url, integ.getEndpointUrl())) {
                close(integ.getId()); // URL changed
                feed = null;
            }
            if (feed == null) {
                feed = new Feed(integ.getId(), integ.getEndpointUrl());
                feeds.put(integ.getId(), feed);
                connect(feed);
            } else if (feed.socket == null && !feed.connecting) {
                connect(feed);
            } else if (feed.socket != null && Duration.between(feed.lastMessage, Instant.now()).getSeconds() > maxIdleSeconds) {
                log.warn("Integration {} silent for {}s, reconnecting", integ.getId(), maxIdleSeconds);
                close(integ.getId());
                Feed fresh = new Feed(integ.getId(), integ.getEndpointUrl());
                feeds.put(integ.getId(), fresh);
                connect(fresh);
            }
        }
    }

    private void connect(Feed feed) {
        feed.connecting = true;
        client.newWebSocketBuilder()
                .buildAsync(URI.create(feed.url), new Listener(feed))
                .thenAccept(ws -> {
                    feed.socket = ws;
                    feed.connecting = false;
                    feed.lastMessage = Instant.now();
                    status(feed.id, "CONNECTED", null);
                    jdbc.update("UPDATE supplier_integrations SET last_connected_at = :now WHERE id = :id",
                            new MapSqlParameterSource().addValue("now", Timestamp.valueOf(LocalDateTime.now())).addValue("id", feed.id));
                    log.info("Supplier integration {} connected", feed.id);
                })
                .exceptionally(ex -> {
                    feed.connecting = false;
                    feed.socket = null;
                    Throwable root = ex;
                    while (root.getCause() != null) root = root.getCause();
                    status(feed.id, "ERROR", String.valueOf(root.getMessage()));
                    log.warn("Supplier integration {} connect failed: {}", feed.id, root.getMessage());
                    return null; // next reconcile retries
                });
    }

    private void close(Long id) {
        Feed feed = feeds.remove(id);
        if (feed != null && feed.socket != null) {
            try {
                feed.socket.sendClose(WebSocket.NORMAL_CLOSURE, "closing");
            } catch (Exception ignored) {
            }
        }
        status(id, "STOPPED", null);
    }

    private void status(Long id, String status, String error) {
        if (id == null) return;
        try {
            jdbc.update("UPDATE supplier_integrations SET status = :s, last_error = :e WHERE id = :id",
                    new MapSqlParameterSource().addValue("s", status)
                            .addValue("e", error != null && error.length() > 1000 ? error.substring(0, 1000) : error)
                            .addValue("id", id));
        } catch (Exception ignored) {
        }
    }

    public boolean isConnected(Long id) {
        Feed f = feeds.get(id);
        return f != null && f.socket != null;
    }

    @PreDestroy
    public void shutdown() {
        feeds.keySet().stream().toList().forEach(this::close);
    }

    private final class Listener implements WebSocket.Listener {
        private final Feed feed;

        Listener(Feed feed) {
            this.feed = feed;
        }

        @Override
        public void onOpen(WebSocket webSocket) {
            webSocket.request(1);
        }

        @Override
        public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {
            feed.lastMessage = Instant.now();
            feed.partial.append(data);
            if (last) {
                String message = feed.partial.toString();
                feed.partial.setLength(0);
                handle(message);
            }
            webSocket.request(1);
            return null;
        }

        private void handle(String message) {
            try {
                SupplierIntegration integ = integrationRepository.findById(feed.id).orElse(null);
                if (integ == null || !integ.isEnabled()) return;
                JsonNode root = objectMapper.readTree(message);
                pipeline.ingest(integ, root, message);
            } catch (Exception e) {
                log.warn("Integration {} message failed: {}", feed.id, e.getMessage());
            }
        }

        @Override
        public CompletionStage<?> onClose(WebSocket webSocket, int statusCode, String reason) {
            feed.socket = null;
            status(feed.id, "DISCONNECTED", "Closed " + statusCode + (reason != null && !reason.isBlank() ? ": " + reason : ""));
            return null;
        }

        @Override
        public void onError(WebSocket webSocket, Throwable error) {
            feed.socket = null;
            status(feed.id, "ERROR", String.valueOf(error.getMessage()));
        }
    }
}
