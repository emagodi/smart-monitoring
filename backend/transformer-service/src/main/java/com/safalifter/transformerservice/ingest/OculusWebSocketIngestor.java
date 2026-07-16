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
import java.util.*;
import java.util.concurrent.*;

@Component
@RequiredArgsConstructor
public class OculusWebSocketIngestor implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(OculusWebSocketIngestor.class);

    @Value("${oculus.ws.url:${powertel.ws.url:}}")
    private String oculusWsUrlProp;

    private final SensorRepository sensorRepository;
    private final SensorReadingRepository sensorReadingRepository;
    private final SensorReadingService sensorReadingService;
    private final ControllerRepository controllerRepository;
    private final ControllerReadingRepository controllerReadingRepository;
    private final ControllerReadingService controllerReadingService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${oculus.ws.log:${powertel.ws.log:false}}")
    private boolean logWs;

    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();

    @Override
    public void run(ApplicationArguments args) {

        if (oculusWsUrlProp == null || oculusWsUrlProp.isBlank()) {
            log.info("Oculus WebSocket URL not configured");
            return;
        }

        connect();
    }

    private void connect() {

        try {

            HttpClient client = HttpClient.newHttpClient();

            client.newWebSocketBuilder()
                    .buildAsync(URI.create(oculusWsUrlProp), new Listener())
                    .thenAccept(ws -> log.info("Connected to Oculus WebSocket"))
                    .exceptionally(ex -> {
                        log.error("WebSocket connection failed", ex);
                        reconnect();
                        return null;
                    });

        } catch (Exception e) {

            log.error("WebSocket start error", e);
            reconnect();

        }
    }

    private void reconnect() {

        scheduler.schedule(() -> {

            log.info("Reconnecting WebSocket...");
            connect();

        }, 10, TimeUnit.SECONDS);

    }

    private class Listener implements WebSocket.Listener {

        @Override
        public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {

            try {

                String message = data.toString();

                if (logWs) log.info("WS {}", message);

                processMessage(message);

            } catch (Exception e) {

                log.error("WS processing error", e);

            }

            return WebSocket.Listener.super.onText(webSocket, data, last);
        }

        @Override
        public void onError(WebSocket webSocket, Throwable error) {

            log.error("WebSocket error", error);
            reconnect();

        }

        @Override
        public CompletionStage<?> onClose(WebSocket webSocket, int statusCode, String reason) {

            log.warn("WebSocket closed {} {}", statusCode, reason);
            reconnect();

            return WebSocket.Listener.super.onClose(webSocket, statusCode, reason);
        }
    }

    private void processMessage(String payload) {

        try {

            JsonNode root = objectMapper.readTree(payload);

            String cmd = root.path("cmd").asText();

            if (!("rx".equals(cmd) || "gw".equals(cmd))) return;

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

}
