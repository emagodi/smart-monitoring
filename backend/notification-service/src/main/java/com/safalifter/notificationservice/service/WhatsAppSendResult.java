package com.safalifter.notificationservice.service;

import java.time.LocalDateTime;

public record WhatsAppSendResult(
        boolean accepted,
        String deliveryStatus,
        String providerMessageId,
        String providerConversationId,
        String providerStatus,
        String providerErrorCode,
        String providerErrorTitle,
        LocalDateTime statusTimestamp,
        String payloadType,
        String templateName,
        String decisionReason
) {
    public static WhatsAppSendResult accepted(String providerMessageId, LocalDateTime statusTimestamp) {
        return accepted(providerMessageId, statusTimestamp, "TEXT", null, "free-form window open");
    }

    public static WhatsAppSendResult failed(String errorCode, String errorTitle, LocalDateTime statusTimestamp) {
        return failed(errorCode, errorTitle, statusTimestamp, null, null, null);
    }

    public static WhatsAppSendResult accepted(
            String providerMessageId,
            LocalDateTime statusTimestamp,
            String payloadType,
            String templateName,
            String decisionReason
    ) {
        return new WhatsAppSendResult(
                true,
                "ACCEPTED",
                providerMessageId,
                null,
                "accepted",
                null,
                null,
                statusTimestamp,
                payloadType,
                templateName,
                decisionReason
        );
    }

    public static WhatsAppSendResult failed(
            String errorCode,
            String errorTitle,
            LocalDateTime statusTimestamp,
            String payloadType,
            String templateName,
            String decisionReason
    ) {
        return new WhatsAppSendResult(
                false,
                "FAILED",
                null,
                null,
                "failed",
                errorCode,
                errorTitle,
                statusTimestamp,
                payloadType,
                templateName,
                decisionReason
        );
    }
}
