package com.safalifter.transformerservice.payload.client;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class SendNotificationRequest {
    private String userId;
    private String offerId;
    private NotificationType notificationType;
    private String supplierCode;
    private String sourceSystem;
    private String referenceId;
    private String recipientName;
    private String message;
    private String phone;
    private String whatsappNumber;
    private String email;
    private String subject;
}
