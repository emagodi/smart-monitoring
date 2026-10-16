package com.safalifter.transformerservice.ingest.framework;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Component;

import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * For partners whose network-server application already decodes the payload (LORIOT custom
 * decoder, TTN payload formatter, or an HTTP push with JSON). Reads the first object found
 * under "decoded", "object", "decoded_payload" or "fields" (or the message root) and maps
 * common key names:
 *   motion / pir / occupancy / DI1           -> primary trigger
 *   door / contact / open / vibration / DI2   -> secondary trigger
 *   battery / bat / batt                       -> battery
 */
@Component
public class JsonFieldsDecoder implements UplinkDecoder {

    public static final String KEY = "json-fields";

    @Override
    public String key() {
        return KEY;
    }

    @Override
    public String label() {
        return "Pre-decoded JSON (motion / door / vibration fields)";
    }

    @Override
    public DecodedUplink decode(byte[] payload, int port, JsonNode message) {
        JsonNode node = pick(message);
        Map<String, Object> fields = new LinkedHashMap<>();
        Boolean primary = null;
        Boolean secondary = null;
        Integer battery = null;
        if (node != null && node.isObject()) {
            Iterator<Map.Entry<String, JsonNode>> it = node.fields();
            while (it.hasNext()) {
                Map.Entry<String, JsonNode> e = it.next();
                String k = e.getKey().toLowerCase(Locale.ROOT);
                JsonNode v = e.getValue();
                if (v.isValueNode()) {
                    fields.put(e.getKey(), v.isNumber() ? v.numberValue() : v.isBoolean() ? v.booleanValue() : v.asText());
                }
                if (k.equals("motion") || k.equals("pir") || k.equals("occupancy") || k.equals("di1") || k.equals("motion_detected")) {
                    primary = or(primary, truthy(v));
                } else if (k.equals("door") || k.equals("contact") || k.equals("open") || k.equals("door_open")
                        || k.equals("vibration") || k.equals("tamper") || k.equals("di2")) {
                    secondary = or(secondary, truthy(v));
                } else if ((k.equals("battery") || k.equals("bat") || k.equals("batt")) && v.isNumber()) {
                    battery = v.asInt();
                }
            }
        }
        if (battery == null && message != null && message.has("bat")) {
            battery = message.path("bat").asInt();
        }
        return new DecodedUplink(primary, secondary, battery, fields);
    }

    private static JsonNode pick(JsonNode message) {
        if (message == null) return null;
        for (String key : new String[]{"decoded", "object", "decoded_payload", "fields", "data_decoded"}) {
            if (message.path(key).isObject()) return message.path(key);
        }
        return message;
    }

    private static boolean truthy(JsonNode v) {
        if (v.isBoolean()) return v.booleanValue();
        if (v.isNumber()) return v.asDouble() != 0;
        String s = v.asText("").trim().toLowerCase(Locale.ROOT);
        return s.equals("true") || s.equals("1") || s.equals("open") || s.equals("detected") || s.equals("yes") || s.equals("on") || s.equals("alarm");
    }

    private static Boolean or(Boolean a, boolean b) {
        return (a != null && a) || b;
    }
}
