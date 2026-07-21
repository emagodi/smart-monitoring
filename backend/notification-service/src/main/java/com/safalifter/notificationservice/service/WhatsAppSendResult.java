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
        LocalDateTime statusTimestamp
) {
    public static WhatsAppSendResult accepted(String providerMessageId, LocalDateTime statusTimestamp) {
        return new WhatsAppSendResult(true, "ACCEPTED", providerMessageId, null, "accepted", null, null, statusTimestamp);
    }

    public static WhatsAppSendResult failed(String errorCode, String errorTitle, LocalDateTime statusTimestamp) {
        return new WhatsAppSendResult(false, "FAILED", null, null, "failed", errorCode, errorTitle, statusTimestamp);
    }
}
