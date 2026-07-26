package com.safalifter.notificationservice.model;

import com.safalifter.notificationservice.enums.NotificationChannel;
import com.safalifter.notificationservice.enums.NotificationType;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.GenericGenerator;

import javax.persistence.Entity;
import javax.persistence.EnumType;
import javax.persistence.Enumerated;
import javax.persistence.GeneratedValue;
import javax.persistence.Id;
import javax.persistence.Lob;
import java.time.LocalDateTime;

@Entity(name = "notifications")
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class Notification {
    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(name = "UUID", strategy = "org.hibernate.id.UUIDGenerator")
    private String id;

    private String userId;
    private String offerId;
    private String subject;
    private String message;
    private String supplierCode;
    private String recipientName;
    private String recipientAddress;

    @Enumerated(EnumType.STRING)
    private NotificationType notificationType;

    @Enumerated(EnumType.STRING)
    private NotificationChannel channel;

    private String deliveryStatus;
    private String sourceSystem;
    private String referenceId;
    private String providerMessageId;
    private String providerConversationId;
    private String providerStatus;
    private String providerErrorCode;
    private String providerErrorTitle;
    private String payloadType;
    private String templateName;

    @Lob
    private String templateParameters;

    private LocalDateTime acceptedTimestamp;
    private LocalDateTime deliveredTimestamp;
    private LocalDateTime readTimestamp;
    private LocalDateTime failedTimestamp;
    private LocalDateTime lastStatusTimestamp;

    @CreationTimestamp
    private LocalDateTime creationTimestamp;
}
