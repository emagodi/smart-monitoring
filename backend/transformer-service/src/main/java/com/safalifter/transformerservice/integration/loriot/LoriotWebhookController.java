package com.safalifter.transformerservice.integration.loriot;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.safalifter.transformerservice.entities.Gateway;
import com.safalifter.transformerservice.repository.GatewayRepository;
import com.safalifter.transformerservice.service.GatewayStatusService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/internal/integrations/loriot")
@RequiredArgsConstructor
@Slf4j
public class LoriotWebhookController {

    private final LoriotProperties properties;
    private final GatewayRepository gatewayRepository;
    private final GatewayStatusService gatewayStatusService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @PostMapping("/gateway-events")
    public ResponseEntity<Void> receiveGatewayEvent(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody(required = false) String rawBody
    ) {
        if (!validateAuth(authorization)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        if (rawBody == null || rawBody.isBlank()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
        JsonNode event;
        try {
            event = objectMapper.readTree(rawBody);
        } catch (Exception e) {
            log.warn("LORIOT webhook: cannot parse JSON body");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
        try {
            List<Gateway> targets = resolveGateways(event);
            String summary = summarizeSafe(event);
            log.info("LORIOT webhook event: {} affecting {} gateways", summary, targets.size());
            for (Gateway g : targets) {
                try {
                    gatewayStatusService.updateFromNotification(g, event);
                } catch (Exception e) {
                    log.warn("LORIOT webhook: status update failed for gateway id={}", g.getId(), e);
                }
            }
        } catch (Exception e) {
            log.warn("LORIOT webhook: processing exception", e);
            return ResponseEntity.status(HttpStatus.ACCEPTED).build();
        }
        return ResponseEntity.status(HttpStatus.ACCEPTED).build();
    }

    private boolean validateAuth(String authorization) {
        String secret = properties.getNotificationSecret();
        if (secret == null || secret.isBlank()) {
            log.warn("loriot.notification-secret is blank; rejecting webhook call");
            return false;
        }
        if (authorization == null || authorization.isBlank()) {
            return false;
        }
        String expected = "Bearer " + secret;
        return expected.equals(authorization.trim());
    }

    private List<Gateway> resolveGateways(JsonNode event) {
        List<Gateway> result = new ArrayList<>();
        List<String> candidateEuis = extractGatewayIdentifiers(event);
        for (String raw : candidateEuis) {
            String norm = GatewayStatusService.normalizeEui(raw);
            if (norm == null || norm.isBlank()) continue;
            gatewayRepository.findByNormalizedGatewayEui(norm).ifPresent(result::add);
            String macNorm = GatewayStatusService.normalizeMac(raw);
            if (macNorm != null && !macNorm.equals(norm)) {
                gatewayRepository.findByNormalizedMac(macNorm).ifPresent(g -> {
                    if (!result.contains(g)) result.add(g);
                });
            }
        }
        JsonNode gwIdNode = firstNode(event, "gatewayId", "gateway_id", "id", "_id");
        if (gwIdNode != null && !gwIdNode.isNull() && !gwIdNode.isMissingNode()) {
            String s = gwIdNode.asText();
            if (s != null && !s.isBlank()) {
                gatewayRepository.findByLoriotGatewayId(s.trim()).ifPresent(g -> {
                    if (!result.contains(g)) result.add(g);
                });
            }
        }
        return result;
    }

    private List<String> extractGatewayIdentifiers(JsonNode event) {
        List<String> out = new ArrayList<>();
        for (String k : new String[]{"gweui", "gwEui", "gatewayEui", "gateway_eui", "EUI", "eui", "mac", "MAC", "macAddress"}) {
            JsonNode n = event.path(k);
            if (n != null && !n.isMissingNode() && !n.isNull()) {
                String s = n.asText();
                if (s != null && !s.isBlank()) out.add(s.trim());
            }
        }
        JsonNode gws = event.path("gws");
        if (gws.isArray()) {
            for (JsonNode gw : gws) {
                for (String k : new String[]{"gweui", "gwEui", "gatewayEui", "EUI", "eui", "mac"}) {
                    JsonNode n = gw.path(k);
                    if (n != null && !n.isMissingNode() && !n.isNull()) {
                        String s = n.asText();
                        if (s != null && !s.isBlank()) out.add(s.trim());
                    }
                }
            }
        }
        return out;
    }

    private String summarizeSafe(JsonNode event) {
        String type = textOr(event, "event", "type", "status", "cmd", "eventType");
        StringBuilder sb = new StringBuilder();
        if (type != null) sb.append("type=").append(type);
        List<String> euis = extractGatewayIdentifiers(event);
        if (!euis.isEmpty()) sb.append(" gws=").append(euis.size());
        String s = sb.toString();
        return s.isEmpty() ? "<unclassified>" : s;
    }

    private static String textOr(JsonNode node, String... keys) {
        for (String k : keys) {
            JsonNode n = node.path(k);
            if (!n.isMissingNode() && !n.isNull()) {
                String s = n.asText();
                if (s != null && !s.isBlank()) return s.trim();
            }
        }
        return null;
    }

    private static JsonNode firstNode(JsonNode node, String... keys) {
        for (String k : keys) {
            JsonNode n = node.path(k);
            if (!n.isMissingNode() && !n.isNull()) return n;
        }
        return null;
    }
}
