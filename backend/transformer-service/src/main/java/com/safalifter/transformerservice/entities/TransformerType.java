package com.safalifter.transformerservice.entities;

import java.util.Locale;

public enum TransformerType {
    POLE_MOUNTED,
    GROUND_MOUNTED;

    public static TransformerType fromValue(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        String normalized = value.trim()
                .toUpperCase(Locale.ROOT)
                .replace('-', '_')
                .replace(' ', '_');

        return switch (normalized) {
            case "POLE", "POLE_MOUNTED", "POLEMOUNTED" -> POLE_MOUNTED;
            case "GROUND", "GROUND_MOUNTED", "GROUNDMOUNTED", "PAD", "PAD_MOUNTED", "PADMOUNTED" -> GROUND_MOUNTED;
            default -> null;
        };
    }
}
