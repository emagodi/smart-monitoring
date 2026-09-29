package com.safalifter.transformerservice.service;

import com.safalifter.transformerservice.entities.Gateway;
import com.safalifter.transformerservice.entities.GatewayStatusHistory;
import com.safalifter.transformerservice.enums.GatewayStatus;
import com.safalifter.transformerservice.enums.GatewayStatusSource;
import com.safalifter.transformerservice.integration.loriot.LoriotGateway;
import com.safalifter.transformerservice.repository.GatewayRepository;
import com.safalifter.transformerservice.repository.GatewayStatusHistoryRepository;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;

@Service
@RequiredArgsConstructor
@Slf4j
public class GatewayStatusService {

    private final GatewayRepository gatewayRepository;
    private final GatewayStatusHistoryRepository statusHistoryRepository;

    @Value("${gateway.offline-grace-ms:600000}")
    private long offlineGraceMs;

    @Value("${gateway.loriot-freshness-ms:900000}")
    private long loriotFreshnessMs;

    @Value("${gateway.uplink-freshness-ms:7200000}")
    private long uplinkFreshnessMs;

    @Transactional
    public void updateFromLoriotApi(Gateway gateway, LoriotGateway dto) {
        if (gateway == null || dto == null) return;
        GatewayStatus reported = null;
        if (dto.getOnline() != null) {
            reported = dto.getOnline() ? GatewayStatus.ONLINE : GatewayStatus.OFFLINE;
        } else if (dto.getStatus() != null) {
            String s = dto.getStatus().toLowerCase().trim();
            if (s.contains("offline") || s.contains("down")) {
                reported = GatewayStatus.OFFLINE;
            } else if (s.contains("online") || s.contains("up") || s.contains("connected")) {
                reported = GatewayStatus.ONLINE;
            }
        }
        if (reported != null) {
            gateway.setLoriotReportedStatus(reported);
        }
        if (dto.getLastSeen() != null) {
            gateway.setLastLoriotSeenAt(dto.getLastSeen());
        } else if (reported == GatewayStatus.ONLINE) {
            gateway.setLastLoriotSeenAt(Instant.now());
        }
        gateway.setLastHealthCheckAt(Instant.now());
        computeAndApplyEffectiveStatus(gateway, GatewayStatusSource.LORIOT_API);
    }

    @Transactional
    public void updateFromNotification(Long gatewayId, JsonNode event) {
        Gateway gateway = gatewayRepository.findById(gatewayId).orElse(null);
        if (gateway == null) return;
        updateFromNotification(gateway, event);
    }

    @Transactional
    public void updateFromNotification(Gateway gateway, JsonNode event) {
        if (gateway == null || event == null) return;
        GatewayStatus reported = parseNotificationStatus(event);
        String reason = extractText(event, "reason", "message", "text", "title");
        if (reported != null) {
            gateway.setLoriotReportedStatus(reported);
            if (reported == GatewayStatus.ONLINE) {
                gateway.setLastLoriotSeenAt(Instant.now());
            }
        }
        gateway.setLastHealthCheckAt(Instant.now());
        computeAndApplyEffectiveStatus(gateway, GatewayStatusSource.LORIOT_NOTIFICATION, reason);
    }

    @Transactional
    public void registerUplinkTraffic(String normalizedEui, Instant ts) {
        if (normalizedEui == null || normalizedEui.isBlank()) return;
        Gateway gateway = gatewayRepository.findByNormalizedGatewayEui(normalizedEui).orElse(null);
        if (gateway == null) {
            return;
        }
        Instant stamp = ts != null ? ts : Instant.now();
        if (gateway.getLastTrafficSeenAt() == null || stamp.isAfter(gateway.getLastTrafficSeenAt())) {
            gateway.setLastTrafficSeenAt(stamp);
        }
        computeAndApplyEffectiveStatus(gateway, GatewayStatusSource.UPLINK_TRAFFIC);
    }

    public GatewayStatus computeEffectiveStatusNow(Gateway gateway) {
        if (gateway == null) return GatewayStatus.UNKNOWN;
        if (Boolean.TRUE.equals(gateway.getDecommissioned())) {
            return GatewayStatus.NEVER_SEEN;
        }
        Instant now = Instant.now();
        if (gateway.getLoriotReportedStatus() != null) {
            Instant lastSeen = gateway.getLastLoriotSeenAt();
            boolean fresh = lastSeen != null && Duration.between(lastSeen, now).toMillis() <= loriotFreshnessMs;
            if (fresh) {
                return gateway.getLoriotReportedStatus();
            }
        }
        Instant lastTraffic = gateway.getLastTrafficSeenAt();
        boolean uplinkFresh = lastTraffic != null && Duration.between(lastTraffic, now).toMillis() <= uplinkFreshnessMs;
        if (uplinkFresh && (gateway.getLoriotReportedStatus() == null || gateway.getLoriotReportedStatus() != GatewayStatus.OFFLINE)) {
            return GatewayStatus.ONLINE;
        }
        Instant lastHealth = gateway.getLastHealthCheckAt();
        Instant lastLoriot = gateway.getLastLoriotSeenAt();
        boolean everSeen = lastLoriot != null || lastTraffic != null || lastHealth != null;
        if (!everSeen) {
            return GatewayStatus.NEVER_SEEN;
        }
        if (gateway.getLoriotReportedStatus() == GatewayStatus.OFFLINE) {
            return applyGrace(gateway, now, GatewayStatus.OFFLINE);
        }
        if (!uplinkFresh && gateway.getLoriotReportedStatus() == null) {
            return GatewayStatus.UNKNOWN;
        }
        if (!uplinkFresh) {
            return applyGrace(gateway, now, GatewayStatus.OFFLINE);
        }
        return GatewayStatus.UNKNOWN;
    }

    private GatewayStatus applyGrace(Gateway g, Instant now, GatewayStatus targetOffline) {
        Instant changedAt = g.getStatusChangedAt();
        if (changedAt == null) {
            if (g.getEffectiveStatus() != null && g.getEffectiveStatus() != targetOffline) {
                return GatewayStatus.DEGRADED;
            }
            return targetOffline;
        }
        long elapsedMs = Duration.between(changedAt, now).toMillis();
        if (elapsedMs < offlineGraceMs) {
            GatewayStatus prev = g.getEffectiveStatus();
            if (prev != null && prev != targetOffline) {
                return GatewayStatus.DEGRADED;
            }
            return targetOffline;
        }
        return targetOffline;
    }

    void computeAndApplyEffectiveStatus(Gateway gateway, GatewayStatusSource source) {
        computeAndApplyEffectiveStatus(gateway, source, null);
    }

    void computeAndApplyEffectiveStatus(Gateway gateway, GatewayStatusSource source, String reason) {
        if (gateway == null) return;
        GatewayStatus prevEffective = gateway.getEffectiveStatus();
        GatewayStatus computed = computeEffectiveStatusNow(gateway);
        gateway.setComputedStatus(computed);
        GatewayStatus effective = computed;
        if (computed == GatewayStatus.OFFLINE) {
            Instant now = Instant.now();
            Instant changedAt = gateway.getStatusChangedAt();
            Instant lastChange = changedAt != null ? changedAt : now;
            long elapsed = Duration.between(lastChange, now).toMillis();
            if (elapsed < offlineGraceMs) {
                if (prevEffective != null && prevEffective != GatewayStatus.OFFLINE) {
                    effective = GatewayStatus.DEGRADED;
                }
            }
        }
        if (prevEffective == null || prevEffective != effective) {
            GatewayStatusHistory history = GatewayStatusHistory.builder()
                    .gatewayId(gateway.getId())
                    .prevStatus(prevEffective)
                    .newStatus(effective)
                    .source(source)
                    .reason(reason != null ? reason : defaultReason(effective, source))
                    .observedAt(Instant.now())
                    .build();
            statusHistoryRepository.save(history);
            gateway.setEffectiveStatus(effective);
            gateway.setStatusChangedAt(Instant.now());
            gateway.setStatusReason(reason != null ? reason : defaultReason(effective, source));
            log.info("Gateway id={} status transition: {} -> {} (source={})", gateway.getId(), prevEffective, effective, source);
        } else {
            if (reason != null && (gateway.getStatusReason() == null || gateway.getStatusReason().isBlank())) {
                gateway.setStatusReason(reason);
            }
        }
        gatewayRepository.save(gateway);
    }

    private String defaultReason(GatewayStatus s, GatewayStatusSource source) {
        return "status-engine-" + (source != null ? source.name().toLowerCase() : "system");
    }

    private GatewayStatus parseNotificationStatus(JsonNode event) {
        String eventType = extractText(event, "event", "type", "status", "eventType");
        if (eventType == null) return null;
        String lower = eventType.toLowerCase();
        if (lower.contains("online") || lower.contains("connect") || lower.contains("up")) return GatewayStatus.ONLINE;
        if (lower.contains("offline") || lower.contains("disconnect") || lower.contains("down")) return GatewayStatus.OFFLINE;
        return null;
    }

    private String extractText(JsonNode node, String... keys) {
        for (String k : keys) {
            JsonNode n = node.path(k);
            if (!n.isMissingNode() && !n.isNull()) {
                String s = n.asText();
                if (s != null && !s.isBlank()) return s.trim();
            }
        }
        return null;
    }

    public static String normalizeEui(String raw) {
        if (raw == null || raw.isBlank()) return null;
        return raw.toLowerCase().replaceAll("[^a-f0-9]", "");
    }

    public static String normalizeMac(String raw) {
        if (raw == null || raw.isBlank()) return null;
        return raw.toLowerCase().replaceAll("[^a-f0-9]", "");
    }

    public static String normalizeIccid(String raw) {
        if (raw == null || raw.isBlank()) return null;
        return raw.replaceAll("[^0-9A-Fa-f]", "").toUpperCase();
    }

    public static String normalizeImsi(String raw) {
        if (raw == null || raw.isBlank()) return null;
        return raw.replaceAll("[^0-9]", "");
    }
}
