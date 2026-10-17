package com.safalifter.transformerservice.ingest.framework;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

/** Dragino LT-22222-L I/O controller (used by Oculus). DI1 = motion, DI2 = door / vibration. */
@Component
public class DraginoLt22222Decoder implements UplinkDecoder {

    public static final String KEY = "dragino-lt22222";

    @Override
    public String key() {
        return KEY;
    }

    @Override
    public String label() {
        return "Dragino LT-22222 (DI1 motion, DI2 door/vibration)";
    }

    @Override
    public DecodedUplink decode(byte[] payload, int port, JsonNode message) {
        Map<String, Object> fields = decodeBytes(payload, port);
        Integer battery = message != null && message.has("bat") ? message.path("bat").asInt() : null;
        return new DecodedUplink(
                Boolean.TRUE.equals(fields.get("DI1")),
                Boolean.TRUE.equals(fields.get("DI2")),
                battery,
                fields
        );
    }

    /** Byte-level decoder, shared with the legacy Oculus websocket ingestor. */
    public static Map<String, Object> decodeBytes(byte[] bytes, int fPort) {
        Map<String, Object> result = new HashMap<>();
        if (bytes == null || bytes.length < 11) return result;

        int hardware = (bytes[10] & 0xC0) >> 6;
        int mode = bytes[10] & 0x3F;
        result.put("hardware", hardware == 1 ? "LT22222" : "UNKNOWN");
        result.put("mode", mode);

        int io = bytes[8] & 0xFF;
        result.put("DI1", (io & 0x08) != 0);
        result.put("DI2", (io & 0x10) != 0);
        result.put("DO1", (io & 0x01) != 0);
        result.put("DO2", (io & 0x02) != 0);
        result.put("RO1", (io & 0x80) != 0);
        result.put("RO2", (io & 0x40) != 0);

        if (mode == 1) {
            result.put("mode_name", "Analog Mode");
            result.put("AVI1_voltage", ((bytes[0] & 0xff) << 8 | (bytes[1] & 0xff)) / 1000f);
            result.put("AVI2_voltage", ((bytes[2] & 0xff) << 8 | (bytes[3] & 0xff)) / 1000f);
            result.put("ACI1_current", ((bytes[4] & 0xff) << 8 | (bytes[5] & 0xff)) / 1000f);
            result.put("ACI2_current", ((bytes[6] & 0xff) << 8 | (bytes[7] & 0xff)) / 1000f);
        }
        if (mode == 6) {
            result.put("mode_name", "Exit Mode");
            int alarm = bytes[2] & 0xff;
            result.put("DI1", (alarm & 0x02) != 0);
            result.put("DI2", (alarm & 0x08) != 0);
        }
        return result;
    }
}
