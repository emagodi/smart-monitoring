package com.safalifter.transformerservice.ingest.framework;

import java.util.Map;

/**
 * Supplier-neutral result of decoding one uplink. Every supplier decoder produces this,
 * so the alert / response flow never needs to know which partner or device sent it.
 *
 * Security inputs follow the platform convention used by the alert engine:
 *   primaryTrigger   = motion sensor (DI1)
 *   secondaryTrigger = door contact on Ground Mounted, vibration on Pole Mounted (DI2)
 */
public record DecodedUplink(
        Boolean primaryTrigger,
        Boolean secondaryTrigger,
        Integer battery,
        Map<String, Object> fields
) {
    public static DecodedUplink empty() {
        return new DecodedUplink(null, null, null, Map.of());
    }
}
