package com.safalifter.notificationservice.request;

import com.safalifter.notificationservice.enums.NotificationChannel;
import com.safalifter.notificationservice.enums.NotificationType;
import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class SendNotificationRequest {
    private String userId;
    private String offerId;
    private NotificationType notificationType;
    private List<NotificationChannel> channels;
    private String supplierCode;
    private Long depotId;
    private String sourceSystem;
    private String referenceId;
    private String recipientName;
    private String message;
    private String phone;
    private String whatsappNumber;
    private String email;
    private String subject;
    private String whatsappTemplateName;
    private String whatsappTemplateLanguageCode;
    private List<String> whatsappTemplateParameters;
}
