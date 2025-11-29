package com.safalifter.transformerservice.ingest;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.safalifter.transformerservice.entities.Sensor;
import com.safalifter.transformerservice.entities.SensorReading;
import com.safalifter.transformerservice.repository.SensorReadingRepository;
import com.safalifter.transformerservice.repository.SensorRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.Base64;
import java.util.List;
import java.util.HashMap;
import java.util.regex.Pattern;

@Component
@RequiredArgsConstructor
@Slf4j
public class LoriotWebSocketIngestor implements ApplicationRunner {

    @Value("${loriot.ws.url:}")
    private String loriotWsUrlProp;

    private final SensorRepository sensorRepository;
    private final SensorReadingRepository sensorReadingRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();
    @Value("${loriot.ws.log:false}")
    private boolean logWs;
    @Value("${loriot.default.transformer-id:0}")
    private long defaultTransformerId;
    @Value("${loriot.default.sensor-type:}")
    private String defaultSensorType;

    @Override
    public void run(ApplicationArguments args) {
        String url = loriotWsUrlProp;
        if (url == null || url.isBlank()) {
            url = System.getenv("LORIOT_WS_URL");
        }
        if (url == null || url.isBlank()) {
            log.info("LORIOT WebSocket URL not configured; skipping ingestion");
            return;
        }

        try {
            HttpClient client = HttpClient.newHttpClient();
            client.newWebSocketBuilder()
                    .buildAsync(URI.create(url), new Listener())
                    .thenAccept(ws -> log.info("Connected to LORIOT WebSocket"))
                    .exceptionally(ex -> { log.error("Failed to connect to LORIOT WebSocket", ex); return null; });
        } catch (Exception e) {
            log.error("Error starting LORIOT WebSocket client", e);
        }
    }

    private class Listener implements WebSocket.Listener {
        @Override
        public void onOpen(WebSocket webSocket) {
            WebSocket.Listener.super.onOpen(webSocket);
            log.info("LORIOT WebSocket opened");
            webSocket.request(1);
        }

        @Override
        public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {
            try {
                String message = data.toString();
                if (logWs) {
                    log.info("WS RECV {}", message);
                }
                Map<?,?> json = objectMapper.readValue(message, Map.class);
                Object cmdObj = json.get("cmd");
                if (cmdObj == null) cmdObj = json.get("type");
                String cmd = cmdObj != null ? String.valueOf(cmdObj) : null;
                if (cmd != null && (cmd.equalsIgnoreCase("up") || cmd.equalsIgnoreCase("rx"))) {
                    handleUplink(json, message);
                }
            } catch (Exception e) {
                log.warn("Invalid JSON message from LORIOT", e);
            } finally {
                webSocket.request(1);
            }
            return CompletableFuture.completedFuture(null);
        }

        @Override
        public void onError(WebSocket webSocket, Throwable error) {
            log.error("LORIOT WebSocket error", error);
        }

        @Override
        public CompletionStage<?> onClose(WebSocket webSocket, int statusCode, String reason) {
            log.info("LORIOT WebSocket closed: code={} reason={}", statusCode, reason);
            return CompletableFuture.completedFuture(null);
        }

        private void handleUplink(Map<?,?> msg, String rawMessage) {
            String deveui = extractString(msg, "EUI", "devEui", "deveui", "DevEUI", "eui", "id");
            Integer port = extractInt(msg, "port", "fPort");
            if (deveui == null || port == null) {
                return;
            }
            if (logWs) {
                Object dataField = msg.get("data");
                if (dataField == null) dataField = msg.get("Data");
                log.info("UPLINK deveui={} port={} data={}", deveui, port, dataField);
            }

            String sensorKey = deveui + "-" + port;
            Optional<Sensor> sensorOpt = sensorRepository.findByDeviceId(sensorKey);
            if (sensorOpt.isEmpty()) {
                long tfId = resolveDefaultTransformerId();
                Sensor newSensor = Sensor.builder()
                        .deviceId(sensorKey)
                        .devEui(deveui)
                        .name(deveui + " Port " + port)
                        .type(defaultSensorType == null || defaultSensorType.isBlank() ? null : defaultSensorType)
                        .transformerId(tfId)
                        .build();
                newSensor = sensorRepository.save(newSensor);
                log.info("Auto-created sensor id={} deviceId={} transformerId={}", newSensor.getId(), newSensor.getDeviceId(), newSensor.getTransformerId());
                sensorOpt = Optional.of(newSensor);
            }
            Sensor sensor = sensorOpt.get();

            try {
                String decoded = buildDecodedSummary(msg);
                java.util.Optional<SensorReading> latestOpt = sensorReadingRepository.findTopBySensorIdOrderByUpdatedAtDesc(sensor.getId());
                SensorReading saved;
                if (latestOpt.isPresent()) {
                    SensorReading existing = latestOpt.get();
                    existing.setRawPayload(rawMessage);
                    existing.setDecoded(decoded);
                    saved = sensorReadingRepository.save(existing);
                    log.info("Updated SensorReading id={} sensorId={} primary={}", saved.getId(), sensor.getId(), extractPrimaryValue(saved.getDecoded()));
                } else {
                    SensorReading reading = SensorReading.builder()
                            .sensorId(sensor.getId())
                            .rawPayload(rawMessage)
                            .decoded(decoded)
                            .build();
                    saved = sensorReadingRepository.save(reading);
                    log.info("Saved SensorReading id={} sensorId={} primary={}", saved.getId(), sensor.getId(), extractPrimaryValue(saved.getDecoded()));
                }
                if (logWs) log.info("DECODE {}", saved.getDecoded());
            } catch (Exception e) {
                log.error("Failed to persist sensor reading for {}", sensorKey, e);
            }
        }

        private long resolveDefaultTransformerId() {
            if (defaultTransformerId > 0) return defaultTransformerId;
            try {
                String env = System.getenv("LORIOT_DEFAULT_TRANSFORMER_ID");
                if (env != null && !env.isBlank()) {
                    return Long.parseLong(env.trim());
                }
            } catch (Exception ignored) {}
            return 0L;
        }

        private Object extractPrimaryValue(String decodedJson) {
            try {
                Map<?,?> m = objectMapper.readValue(decodedJson, Map.class);
                return m.get("primary_value");
            } catch (Exception e) {
                return null;
            }
        }

        private String buildDecodedSummary(Map<?,?> msg) {
            try {
                Object dataField = msg.get("data");
                if (dataField == null) dataField = msg.get("Data");
                String payload = dataField != null ? String.valueOf(dataField) : null;
                byte[] buf = toBytes(payload);
                Map<String,Object> decoded = decodeVendor(buf, msg);
                decoded.put("deveui", extractString(msg, "EUI", "devEui", "deveui", "DevEUI", "eui", "id"));
                decoded.put("port", extractInt(msg, "port", "fPort"));
                decoded.put("data", payload);
                return objectMapper.writeValueAsString(decoded);
            } catch (Exception e) {
                return "{}";
            }
        }

        private byte[] toBytes(String s) {
            if (s == null) return null;
            String hs = s.trim();
            if (HEX_PATTERN.matcher(hs).matches()) {
                hs = hs.replace(" ", "");
                try {
                    int len = hs.length();
                    byte[] data = new byte[len / 2];
                    for (int i = 0; i < len; i += 2) {
                        data[i / 2] = (byte) ((Character.digit(hs.charAt(i), 16) << 4)
                                + Character.digit(hs.charAt(i+1), 16));
                    }
                    return data;
                } catch (Exception ignored) {}
            }
            try {
                return Base64.getDecoder().decode(hs);
            } catch (Exception ignored) {}
            return null;
        }

        private Map<String,Object> decodeVendor(byte[] buf, Map<?,?> msg) {
            Map<String,Object> res = new HashMap<>();
            res.put("codec", null);
            res.put("records", List.of());
            res.put("primary_value", null);
            if (buf == null || buf.length == 0) return res;
            String hint = extractCodecHint(msg);
            if ("milesight".equals(hint)) {
                Map<String,Object> milesight = decodeLpp(buf);
                milesight.put("codec", "milesight");
                return milesight;
            }
            Map<String,Object> lpp = decodeLpp(buf);
            List<?> lppRecords = (List<?>) lpp.get("records");
            if (lppRecords != null && !lppRecords.isEmpty()) return lpp;
            Map<String,Object> els = decodeElsys(buf);
            List<?> elsRecords = (List<?>) els.get("records");
            if (elsRecords != null && !elsRecords.isEmpty()) return els;
            return res;
        }

        private String extractCodecHint(Map<?,?> msg) {
            Object v = msg.get("codec");
            if (v == null) v = msg.get("vendor");
            if (v == null) v = msg.get("manufacturer");
            if (v == null) v = msg.get("model");
            if (v instanceof String s) {
                s = s.toLowerCase();
                if (s.contains("milesight")) return "milesight";
                if (s.contains("cayenne") || s.contains("lpp")) return "cayenne";
                if (s.contains("elsys")) return "elsys";
            }
            return null;
        }

        private Map<String,Object> decodeLpp(byte[] buf) {
            List<Map<String,Object>> out = new ArrayList<>();
            int i = 0;
            while (i + 2 <= buf.length) {
                int ch = buf[i] & 0xFF; int t = buf[i+1] & 0xFF; i += 2;
                if (t == 0x02 || t == 0x03 || t == 0x67) {
                    if (i + 2 > buf.length) break;
                    int b0 = buf[i] & 0xFF; int b1 = buf[i+1] & 0xFF; i += 2;
                    int be = (b0 << 8) | b1; if (be >= 0x8000) be = be - 0x10000;
                    int le = (b1 << 8) | b0; if (le >= 0x8000) le = le - 0x10000;
                    Map<String,Object> rec = new HashMap<>();
                    rec.put("channel", ch); rec.put("type", t);
                    if (t == 0x02 || t == 0x03) {
                        rec.put("value_be", be / 100.0);
                        rec.put("value_le", le / 100.0);
                        rec.put("name", "analog");
                        rec.put("unit", "");
                    } else {
                        rec.put("value_be", be / 10.0);
                        rec.put("value_le", le / 10.0);
                        rec.put("name", "temperature");
                        rec.put("unit", "C");
                    }
                    rec.put("channel_label", "ch-" + ch);
                    out.add(rec);
                } else if (t == 0x00 || t == 0x01 || t == 0x68) {
                    if (i + 1 > buf.length) break;
                    int b = buf[i] & 0xFF; i += 1;
                    Map<String,Object> rec = new HashMap<>();
                    rec.put("channel", ch); rec.put("type", t);
                    if (t == 0x68) { rec.put("value", b / 2.0); rec.put("name", "humidity"); rec.put("unit", "%"); }
                    else if (t == 0x00) { rec.put("value", b); rec.put("name", "digital_in"); rec.put("unit", ""); }
                    else { rec.put("value", b); rec.put("name", "digital_out"); rec.put("unit", ""); }
                    rec.put("channel_label", "ch-" + ch);
                    out.add(rec);
                } else {
                    break;
                }
            }
            Double best = null;
            for (Map<String,Object> rec : out) {
                Object name = rec.get("name");
                if ("temperature".equals(name)) {
                    Object v = rec.get("value_le");
                    if (v instanceof Number n) { double d = n.doubleValue(); if (d >= -50.0 && d <= 85.0) { best = d; break; } }
                    v = rec.get("value_be");
                    if (v instanceof Number n) { double d = n.doubleValue(); if (d >= -50.0 && d <= 85.0) { best = d; break; } }
                }
            }
            if (best == null) {
                for (Map<String,Object> rec : out) {
                    if ("humidity".equals(rec.get("name"))) {
                        Object v = rec.get("value"); if (v instanceof Number n) { best = n.doubleValue(); break; }
                    }
                }
            }
            if (best == null) {
                for (Map<String,Object> rec : out) {
                    Object v = rec.get("value"); if (v == null) v = rec.get("value_le"); if (v == null) v = rec.get("value_be");
                    if (v instanceof Number n) { best = n.doubleValue(); break; }
                }
            }
            Map<String,Object> res = new HashMap<>();
            res.put("codec", "cayenne");
            res.put("records", out);
            res.put("primary_value", best);
            return res;
        }

        private Map<String,Object> decodeElsys(byte[] buf) {
            List<Map<String,Object>> out = new ArrayList<>();
            Double primary = null;
            int i = 0;
            while (i < buf.length) {
                int t = buf[i] & 0xFF; i += 1;
                if (t == 0x01 && i + 1 < buf.length) {
                    int v = ((buf[i] & 0xFF) << 8) | (buf[i+1] & 0xFF);
                    if (v >= 0x8000) v = v - 0x10000;
                    double temp = v / 10.0; i += 2;
                    Map<String,Object> rec = new HashMap<>(); rec.put("type", t); rec.put("name", "temperature"); rec.put("value", temp); rec.put("unit", "C");
                    out.add(rec); if (primary == null) primary = temp;
                } else if (t == 0x02 && i < buf.length) {
                    int rh = buf[i] & 0xFF; i += 1;
                    Map<String,Object> rec = new HashMap<>(); rec.put("type", t); rec.put("name", "humidity"); rec.put("value", rh); rec.put("unit", "%");
                    out.add(rec); if (primary == null) primary = (double) rh;
                } else if (t == 0x0A && i < buf.length) {
                    int mv = buf[i] & 0xFF; i += 1;
                    Map<String,Object> rec = new HashMap<>(); rec.put("type", t); rec.put("name", "motion"); rec.put("value", mv); rec.put("unit", "");
                    out.add(rec); if (primary == null) primary = (double) mv;
                } else {
                    break;
                }
            }
            Map<String,Object> res = new HashMap<>();
            res.put("codec", "elsys");
            res.put("records", out);
            res.put("primary_value", primary);
            return res;
        }

        private String extractString(Map<?,?> msg, String... keys) {
            for (String k : keys) {
                Object v = msg.get(k);
                if (v instanceof String s && !s.isBlank()) return s.trim();
            }
            return null;
        }

        private Integer extractInt(Map<?,?> msg, String... keys) {
            for (String k : keys) {
                Object v = msg.get(k);
                if (v instanceof Number n) return n.intValue();
                if (v instanceof String s) {
                    try { return Integer.parseInt(s); } catch (Exception ignored) {}
                }
            }
            return null;
        }
    }
    private static final Pattern HEX_PATTERN = Pattern.compile("[0-9A-Fa-f\\s]+");
}