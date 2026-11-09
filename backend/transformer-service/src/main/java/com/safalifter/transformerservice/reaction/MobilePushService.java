package com.safalifter.transformerservice.reaction;

import com.safalifter.transformerservice.config.AccessScopeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Push notifications to the TIAS mobile app (Expo push service). The app registers its Expo push token after sign-in;
 * every new alert is pushed, with the siren sound, to the phones of the Loss Control staff on duty for the alert's depot.
 * When nobody is on duty there, it goes to everyone in that depot (or national) who can acknowledge alerts, like the web siren.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MobilePushService {

    private static final String EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

    private final NamedParameterJdbcTemplate jdbc;
    private final AccessScopeService scope;
    private final RestTemplate restTemplate;

    /** Optional: an Expo access token, needed only when "enhanced push security" is turned on for the Expo project. */
    @Value("${expo.access-token:}")
    private String expoAccessToken;

    @Value("${mobile.push.enabled:true}")
    private boolean enabled;

    /** One push per alert per 5 minutes, so repeated triggers of the same open alert do not flood phones. */
    private final Map<Long, Long> lastPushed = new ConcurrentHashMap<>();

    public record Register(String expoPushToken, String platform, String appVersion, String deviceName) {}

    public record Unregister(String expoPushToken) {}

    public Map<String, Object> register(Register in) {
        String email = scope.getCurrentUserEmail();
        if (email == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sign in first");
        if (in == null || in.expoPushToken() == null || !in.expoPushToken().startsWith("ExponentPushToken[") && !in.expoPushToken().startsWith("ExpoPushToken[")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Not an Expo push token");
        }
        Timestamp now = Timestamp.valueOf(LocalDateTime.now());
        jdbc.update("""
                INSERT INTO mobile_devices (expo_token, user_email, depot_id, supplier_code, can_ack, platform, app_version, device_name, enabled, created_at, last_seen_at)
                VALUES (:t, :e, :d, :s, :a, :p, :v, :n, 1, :now, :now)
                ON DUPLICATE KEY UPDATE user_email = :e, depot_id = :d, supplier_code = :s, can_ack = :a, platform = :p, app_version = :v,
                    device_name = :n, enabled = 1, last_seen_at = :now""",
                new MapSqlParameterSource().addValue("t", in.expoPushToken().trim()).addValue("e", email.toLowerCase())
                        .addValue("d", scope.getCurrentDepotId()).addValue("s", scope.isSupplierScoped() ? scope.getCurrentSupplierCode() : null)
                        .addValue("a", scope.hasPermission("response.acknowledge"))
                        .addValue("p", cut(in.platform(), 16)).addValue("v", cut(in.appVersion(), 32)).addValue("n", cut(in.deviceName(), 128))
                        .addValue("now", now));
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("registered", true);
        m.put("alerts", scope.hasPermission("response.acknowledge"));
        return m;
    }

    public void unregister(Unregister in) {
        if (in == null || in.expoPushToken() == null) return;
        jdbc.update("UPDATE mobile_devices SET enabled = 0 WHERE expo_token = :t", Map.of("t", in.expoPushToken().trim()));
    }

    /** New (or repeated) alert: push it to the phones that must react. Never throws. */
    @Async
    public void pushAlert(Long alertId, Long depotId, String transformerName, String what, boolean repeat, int occurrences) {
        if (!enabled || alertId == null) return;
        long now = System.currentTimeMillis();
        Long prev = lastPushed.get(alertId);
        if (prev != null && now - prev < 5 * 60_000L) return;
        lastPushed.put(alertId, now);
        if (lastPushed.size() > 5000) lastPushed.clear();
        try {
            List<String> tokens = recipients(depotId);
            if (tokens.isEmpty()) return;
            String title = (repeat ? "Repeated alert #" : "Intrusion alert #") + alertId;
            String body = nz(what, "Security event") + " at " + nz(transformerName, "a transformer")
                    + (repeat && occurrences > 1 ? " · " + occurrences + " events, still open" : "") + ". Tap to respond.";
            List<Map<String, Object>> messages = new ArrayList<>();
            for (String t : tokens) {
                Map<String, Object> msg = new LinkedHashMap<>();
                msg.put("to", t);
                msg.put("title", title);
                msg.put("body", body);
                msg.put("sound", "siren.wav");
                msg.put("channelId", "alerts");
                msg.put("priority", "high");
                msg.put("ttl", 3600);
                msg.put("data", Map.of("type", "ALERT", "alertId", alertId));
                messages.add(msg);
            }
            send(messages);
            log.info("Alert {} pushed to {} phone(s)", alertId, tokens.size());
        } catch (Exception e) {
            log.warn("Push for alert {} failed: {}", alertId, e.getMessage());
        }
    }

    /** On-duty staff of the depot; if none, everyone who can acknowledge in that depot or nationally. */
    private List<String> recipients(Long depotId) {
        List<String> onDuty = depotId == null ? List.of() : jdbc.queryForList("""
                SELECT DISTINCT md.expo_token FROM mobile_devices md
                  JOIN duty_roster dr ON LOWER(dr.user_email) = md.user_email AND dr.on_duty = 1 AND dr.depot_id = :d
                 WHERE md.enabled = 1""", Map.of("d", depotId), String.class);
        if (!onDuty.isEmpty()) return onDuty;
        return jdbc.queryForList("""
                SELECT DISTINCT expo_token FROM mobile_devices
                 WHERE enabled = 1 AND can_ack = 1 AND supplier_code IS NULL AND (depot_id IS NULL OR depot_id = :d)""",
                new MapSqlParameterSource("d", depotId), String.class);
    }

    @SuppressWarnings("unchecked")
    private void send(List<Map<String, Object>> messages) {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);
        h.setAccept(List.of(MediaType.APPLICATION_JSON));
        if (expoAccessToken != null && !expoAccessToken.isBlank()) h.setBearerAuth(expoAccessToken.trim());
        for (int i = 0; i < messages.size(); i += 100) {
            List<Map<String, Object>> chunk = messages.subList(i, Math.min(messages.size(), i + 100));
            Map<String, Object> res = restTemplate.postForObject(EXPO_PUSH_URL, new HttpEntity<>(chunk, h), Map.class);
            Object data = res != null ? res.get("data") : null;
            if (!(data instanceof List<?> tickets)) continue;
            for (int j = 0; j < tickets.size() && j < chunk.size(); j++) {
                if (!(tickets.get(j) instanceof Map<?, ?> ticket) || !"error".equals(ticket.get("status"))) continue;
                Object details = ticket.get("details");
                Object err = details instanceof Map<?, ?> d ? d.get("error") : null;
                if ("DeviceNotRegistered".equals(err)) {
                    jdbc.update("UPDATE mobile_devices SET enabled = 0 WHERE expo_token = :t", Map.of("t", chunk.get(j).get("to")));
                } else {
                    log.debug("Expo push ticket error: {}", ticket.get("message"));
                }
            }
        }
    }

    private static String cut(String s, int n) {
        if (s == null) return null;
        String t = s.trim();
        return t.length() > n ? t.substring(0, n) : t;
    }

    private static String nz(String s, String d) {
        return s == null || s.isBlank() ? d : s;
    }
}
