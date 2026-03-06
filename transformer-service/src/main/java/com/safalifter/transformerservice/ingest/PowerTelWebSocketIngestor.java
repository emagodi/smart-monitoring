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
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.util.HexFormat;
import java.util.Optional;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@Component
@RequiredArgsConstructor
public class PowerTelWebSocketIngestor implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(PowerTelWebSocketIngestor.class);

    @Value("${powertel.ws.url:}")
    private String powertelWsUrlProp;

    private final SensorRepository sensorRepository;
    private final SensorReadingRepository sensorReadingRepository;
    private final SensorReadingService sensorReadingService;
    private final ControllerRepository controllerRepository;
    private final ControllerReadingRepository controllerReadingRepository;
    private final ControllerReadingService controllerReadingService;
    private final ObjectMapper objectMapper = new ObjectMapper();
    
    @Value("${powertel.ws.log:false}")
    private boolean logWs;
    
    @Value("${powertel.default.transformer-id:0}")
    private long defaultTransformerId;
    
    @Value("${powertel.default.sensor-type:}")
    private String defaultSensorType;

    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();

    @Override
    public void run(ApplicationArguments args) {
        String url = resolveUrl();
        if (url == null || url.isBlank()) {
            log.info("PowerTel WebSocket URL not configured; skipping ingestion");
            return;
        }
        connect();
    }

    private String resolveUrl() {
        String url = powertelWsUrlProp;
        if (url == null || url.isBlank()) {
            url = System.getenv("POWERTEL_WS_URL");
        }
        return url;
    }

    private void connect() {
        String url = resolveUrl();
        if (url == null) return;

        try {
            HttpClient client = HttpClient.newHttpClient();
            client.newWebSocketBuilder()
                    .buildAsync(URI.create(url), new Listener())
                    .thenAccept(ws -> log.info("Connected to PowerTel WebSocket"))
                    .exceptionally(ex -> {
                        log.error("Failed to connect to PowerTel WebSocket", ex);
                        scheduleReconnect();
                        return null;
                    });
        } catch (Exception e) {
            log.error("Error starting PowerTel WebSocket client", e);
            scheduleReconnect();
        }
    }

    private void scheduleReconnect() {
        scheduler.schedule(() -> {
            try {
                log.info("Attempting to reconnect to PowerTel WebSocket...");
                connect();
            } catch (Exception e) {
                log.error("Error during reconnection attempt", e);
            }
        }, 10, TimeUnit.SECONDS);
    }

    private class Listener implements WebSocket.Listener {
        @Override
        public void onOpen(WebSocket webSocket) {
            log.info("PowerTel WebSocket opened");
            WebSocket.Listener.super.onOpen(webSocket);
        }

        @Override
        public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {
            try {
                String message = data.toString();
                if (logWs) {
                    log.info("WS RECV {}", message);
                }
                processMessage(message);
            } catch (Exception e) {
                log.error("Error processing WebSocket message", e);
            }
            return WebSocket.Listener.super.onText(webSocket, data, last);
        }

        @Override
        public CompletionStage<?> onClose(WebSocket webSocket, int statusCode, String reason) {
            log.warn("PowerTel WebSocket closed: {} {}", statusCode, reason);
            scheduleReconnect();
            return WebSocket.Listener.super.onClose(webSocket, statusCode, reason);
        }

        @Override
        public void onError(WebSocket webSocket, Throwable error) {
            log.error("PowerTel WebSocket error", error);
            scheduleReconnect();
            WebSocket.Listener.super.onError(webSocket, error);
        }
    }

    private void processMessage(String payload) {
        try {
            JsonNode root = objectMapper.readTree(payload);
            String cmd = root.path("cmd").asText();

            // Only process 'gw' or 'rx' commands that contain data
            if (("gw".equals(cmd) || "rx".equals(cmd)) && root.has("data")) {
                String devEui = root.path("EUI").asText();
                String dataHex = root.path("data").asText();

                Optional<Controller> controllerOpt = controllerRepository.findByDevEui(devEui);
                Controller controller;

                if (controllerOpt.isPresent()) {
                    controller = controllerOpt.get();
                } else {
                    log.info("New controller detected: {}. Auto-registering...", devEui);
                    controller = Controller.builder()
                            .devEui(devEui)
                            .deviceId(devEui) // Default to DevEUI
                            .name("New Controller " + devEui)
                            .type("IO_CONTROLLER")
                            .build();
                    controller = controllerRepository.save(controller);
                }
                
                processControllerData(controller, dataHex, root, payload);
            }
        } catch (Exception e) {
            log.error("Error parsing message: {}", e.getMessage());
        }
    }

    private void processControllerData(Controller controller, String dataHex, JsonNode root, String payload) {
        try {
            System.out.println("Processing controller data: " + dataHex);
            byte[] data = HexFormat.of().parseHex(dataHex);
            System.out.println("Data length: " + data.length);

            boolean di1, di2;
            int status;

            // Heuristic to detect payload type
            // Case 2: 000007ffffffffffff0146 (Byte 2 is 0x07, Status at Byte 9)
            if (data.length > 9 && data[2] == 0x07) {
                status = data[9] & 0xFF;
                // Dragino LT-22222-L Format: Bit 0 is DI1, Bit 1 is DI2
                di1 = (status & 0x01) != 0;
                di2 = (status & 0x02) != 0;
                log.info("Decoded Dragino V2 format. Status: {}, DI1: {}, DI2: {}", status, di1, di2);
            } else {
                // Case 1: 0000000000000000b4ff41 (Byte 2 is 0x00, Status at Byte 8)
                if (data.length <= 8) {
                    log.warn("Controller data too short: {}", dataHex);
                    return;
                }
                status = data[8] & 0xFF;
                // Dragino V1 / Default Format: Bit 3 is DI1, Bit 4 is DI2
                // User reports Active Low behavior (0 when triggered, 1 when safe)
                // Payload 0x24 (0010 0100) -> Bit 3=0 (DI1 Trigger), Bit 4=0 (DI2 Trigger)
                // Payload 0x3C (0011 1100) -> Bit 3=1 (DI1 Safe), Bit 4=1 (DI2 Safe)
                // Payload 0xB4 (1011 0100) -> Bit 3=0 (DI1 Trigger), Bit 4=1 (DI2 Safe)
                di1 = (status & 0x08) == 0;
                di2 = (status & 0x10) == 0;
                log.info("Decoded Dragino V1 format (Active Low). Status: {}, DI1: {}, DI2: {}", status, di1, di2);
            }

            int battery = root.path("bat").asInt();
            int rssi = 0;
            int snr = 0;

            if (root.has("gws") && root.get("gws").isArray() && root.get("gws").size() > 0) {
                JsonNode gw = root.get("gws").get(0);
                rssi = gw.path("rssi").asInt();
                snr = gw.path("snr").asInt();
            }

            ControllerReading reading = ControllerReading.builder()
                    .controllerId(controller.getId())
                    .rawPayload(payload)
                    .di1(di1)
                    .di2(di2)
                    .battery(battery)
                    .rssi(rssi)
                    .snr(snr)
                    .build();

            controllerReadingService.save(reading);
            log.info("Saved controller reading for devEui: {}, DI1: {}, DI2: {}", controller.getDevEui(), di1, di2);

            // Also save SensorReading if a Sensor exists with this DevEUI
            java.util.Optional<com.safalifter.transformerservice.entities.Sensor> sensorOpt = sensorRepository.findByDevEui(controller.getDevEui());
            if (sensorOpt.isPresent()) {
                com.safalifter.transformerservice.entities.Sensor sensor = sensorOpt.get();
                java.util.Map<String, Object> decodedMap = new java.util.HashMap<>();
                decodedMap.put("di1", di1);
                decodedMap.put("di2", di2);
                decodedMap.put("status", status);
                decodedMap.put("battery", battery);
                decodedMap.put("rssi", rssi);
                decodedMap.put("snr", snr);
                decodedMap.put("Hardware_mode", "LT22222"); // Add hint for frontend

                String decodedJson = objectMapper.writeValueAsString(decodedMap);

                com.safalifter.transformerservice.entities.SensorReading sensorReading = com.safalifter.transformerservice.entities.SensorReading.builder()
                        .sensorId(sensor.getId())
                        .rawPayload(payload)
                        .decoded(decodedJson)
                        .build();

                com.safalifter.transformerservice.entities.SensorReading savedReading = sensorReadingRepository.save(sensorReading);
                sensorReadingService.processTriggers(savedReading);
                log.info("Saved sensor reading for sensor: {}, DI1: {}, DI2: {}", sensor.getName(), di1, di2);
            }

        } catch (Exception e) {
            log.error("Error processing controller data", e);
        }
    }
}
