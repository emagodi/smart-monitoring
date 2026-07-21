package com.safalifter.notificationservice.service;

import com.safalifter.notificationservice.clients.AuthRoutingClient;
import com.safalifter.notificationservice.enums.NotificationChannel;
import com.safalifter.notificationservice.enums.NotificationType;
import com.safalifter.notificationservice.model.Notification;
import com.safalifter.notificationservice.payload.NotificationRecipientResponse;
import com.safalifter.notificationservice.repository.NotificationRepository;
import com.safalifter.notificationservice.request.SendNotificationRequest;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class NotificationService {
    private final NotificationRepository notificationRepository;
    private final SmsSender smsSender;
    private final SmtpEmailSender smtpEmailSender;
    private final EwsEmailSender ewsEmailSender;
    private final WhatsAppSender whatsAppSender;
    private final AuthRoutingClient authRoutingClient;

    @Value("${notification.default.sms.to:}")
    private String defaultSmsTo;
    @Value("${notification.default.email.to:}")
    private String defaultEmailTo;
    @Value("${notification.default.whatsapp.to:}")
    private String defaultWhatsappTo;

    public void save(SendNotificationRequest request) {
        NotificationType notificationType = request.getNotificationType() != null
                ? request.getNotificationType()
                : NotificationType.SYSTEM_NOTICE;

        for (NotificationRecipientResponse recipient : resolveRecipients(request, notificationType)) {
            for (NotificationChannel channel : resolveChannels(request, recipient)) {
                ChannelTarget target = resolveTarget(channel, request, recipient);
                Notification notification = Notification.builder()
                        .id(UUID.randomUUID().toString())
                        .userId(recipient.getUserId() != null ? String.valueOf(recipient.getUserId()) : request.getUserId())
                        .offerId(request.getOfferId())
                        .subject(request.getSubject())
                        .message(request.getMessage())
                        .supplierCode(firstNonBlank(request.getSupplierCode(), recipient.getSupplierCode()))
                        .recipientName(target.name())
                        .recipientAddress(target.address())
                        .notificationType(notificationType)
                        .channel(channel)
                        .sourceSystem(request.getSourceSystem())
                        .referenceId(request.getReferenceId())
                        .payloadType(channel == NotificationChannel.WHATSAPP && usesWhatsAppTemplate(request) ? "TEMPLATE" : "TEXT")
                        .templateName(channel == NotificationChannel.WHATSAPP ? trimToNull(request.getWhatsappTemplateName()) : null)
                        .templateParameters(channel == NotificationChannel.WHATSAPP ? joinTemplateParameters(request.getWhatsappTemplateParameters()) : null)
                        .build();

                if (target.address() == null || target.address().isBlank()) {
                    notification.setDeliveryStatus("SKIPPED");
                    notification.setProviderStatus("skipped");
                    notification.setLastStatusTimestamp(LocalDateTime.now());
                } else {
                    dispatchNotification(notification, request, channel, target.address());
                }

                notificationRepository.save(notification);
            }
        }
    }

    public void handleWhatsAppWebhook(JsonNode payload) {
        if (payload == null || payload.isMissingNode()) {
            return;
        }

        for (JsonNode entry : payload.path("entry")) {
            for (JsonNode change : entry.path("changes")) {
                JsonNode value = change.path("value");
                for (JsonNode statusNode : value.path("statuses")) {
                    updateNotificationStatus(statusNode);
                }
            }
        }
    }

    private List<NotificationRecipientResponse> resolveRecipients(SendNotificationRequest request, NotificationType notificationType) {
        if (hasDirectRecipient(request)) {
            return List.of(buildDirectRecipient(request, notificationType));
        }

        try {
            List<NotificationRecipientResponse> recipients = authRoutingClient.getNotificationRecipients(notificationType, request.getSupplierCode());
            if (recipients != null && !recipients.isEmpty()) {
                return recipients;
            }
        } catch (Exception ignored) {
            // Fallback to configured defaults when auth routing is temporarily unavailable.
        }

        List<NotificationRecipientResponse> fallback = new ArrayList<>();
        if (defaultEmailTo != null && !defaultEmailTo.isBlank()
                || defaultSmsTo != null && !defaultSmsTo.isBlank()
                || defaultWhatsappTo != null && !defaultWhatsappTo.isBlank()) {
            fallback.add(NotificationRecipientResponse.builder()
                    .firstname("Default")
                    .lastname("Recipient")
                    .email(defaultEmailTo)
                    .phone(defaultSmsTo)
                    .whatsappNumber(defaultWhatsappTo)
                    .supplierCode(request.getSupplierCode())
                    .notificationType(notificationType)
                    .emailEnabled(defaultEmailTo != null && !defaultEmailTo.isBlank())
                    .smsEnabled(defaultSmsTo != null && !defaultSmsTo.isBlank())
                    .whatsappEnabled(defaultWhatsappTo != null && !defaultWhatsappTo.isBlank())
                    .build());
        }
        return fallback;
    }

    private NotificationRecipientResponse buildDirectRecipient(SendNotificationRequest request, NotificationType notificationType) {
        EnumSet<NotificationChannel> requestedChannels = request.getChannels() == null || request.getChannels().isEmpty()
                ? EnumSet.noneOf(NotificationChannel.class)
                : EnumSet.copyOf(request.getChannels());

        boolean emailEnabled = !isBlank(request.getEmail()) && (requestedChannels.isEmpty() || requestedChannels.contains(NotificationChannel.EMAIL));
        boolean smsEnabled = !isBlank(request.getPhone()) && (requestedChannels.isEmpty() || requestedChannels.contains(NotificationChannel.SMS));
        boolean whatsappEnabled = !isBlank(request.getWhatsappNumber()) && (requestedChannels.isEmpty() || requestedChannels.contains(NotificationChannel.WHATSAPP));

        return NotificationRecipientResponse.builder()
                .userId(parseUserId(request.getUserId()))
                .firstname(request.getRecipientName())
                .email(request.getEmail())
                .phone(request.getPhone())
                .whatsappNumber(request.getWhatsappNumber())
                .supplierCode(request.getSupplierCode())
                .notificationType(notificationType)
                .emailEnabled(emailEnabled)
                .smsEnabled(smsEnabled)
                .whatsappEnabled(whatsappEnabled)
                .build();
    }

    private EnumSet<NotificationChannel> resolveChannels(SendNotificationRequest request, NotificationRecipientResponse recipient) {
        if (request.getChannels() != null && !request.getChannels().isEmpty()) {
            return EnumSet.copyOf(request.getChannels());
        }

        EnumSet<NotificationChannel> channels = EnumSet.noneOf(NotificationChannel.class);
        if (recipient.isAllChannelsEnabled() || recipient.isEmailEnabled()) {
            channels.add(NotificationChannel.EMAIL);
        }
        if (recipient.isAllChannelsEnabled() || recipient.isSmsEnabled()) {
            channels.add(NotificationChannel.SMS);
        }
        if (recipient.isAllChannelsEnabled() || recipient.isWhatsappEnabled()) {
            channels.add(NotificationChannel.WHATSAPP);
        }
        return channels;
    }

    private ChannelTarget resolveTarget(NotificationChannel channel, SendNotificationRequest request, NotificationRecipientResponse recipient) {
        String name = firstNonBlank(request.getRecipientName(), joinName(recipient.getFirstname(), recipient.getLastname()));
        return switch (channel) {
            case EMAIL -> new ChannelTarget(name, firstNonBlank(request.getEmail(), recipient.getEmail(), defaultEmailTo));
            case SMS -> new ChannelTarget(name, firstNonBlank(request.getPhone(), recipient.getPhone(), defaultSmsTo));
            case WHATSAPP -> new ChannelTarget(name, firstNonBlank(request.getWhatsappNumber(), recipient.getWhatsappNumber(), defaultWhatsappTo));
        };
    }

    private boolean hasDirectRecipient(SendNotificationRequest request) {
        return !isBlank(request.getEmail()) || !isBlank(request.getPhone()) || !isBlank(request.getWhatsappNumber());
    }

    private Long parseUserId(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Long.valueOf(value);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private String joinName(String firstname, String lastname) {
        String joined = (firstname == null ? "" : firstname.trim()) + " " + (lastname == null ? "" : lastname.trim());
        String normalized = joined.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (!isBlank(value)) {
                return value.trim();
            }
        }
        return null;
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    public List<Notification> getAllByUserId(String id) {
        return notificationRepository.findAllByUserIdOrderByCreationTimestampDesc(id);
    }

    private void dispatchNotification(Notification notification, SendNotificationRequest request, NotificationChannel channel, String address) {
        switch (channel) {
            case EMAIL -> applySynchronousStatus(
                    notification,
                    smtpEmailSender.send(address, request.getSubject(), request.getMessage())
                            || ewsEmailSender.send(address, request.getSubject(), request.getMessage())
            );
            case SMS -> applySynchronousStatus(notification, smsSender.send(address, request.getMessage()));
            case WHATSAPP -> applyWhatsAppStatus(notification, sendWhatsapp(request, address));
        }
    }

    private void applySynchronousStatus(Notification notification, boolean sent) {
        notification.setDeliveryStatus(sent ? "SENT" : "FAILED");
        notification.setProviderStatus(sent ? "sent" : "failed");
        notification.setLastStatusTimestamp(LocalDateTime.now());
        if (sent) {
            notification.setAcceptedTimestamp(LocalDateTime.now());
        } else {
            notification.setFailedTimestamp(LocalDateTime.now());
        }
    }

    private void applyWhatsAppStatus(Notification notification, WhatsAppSendResult result) {
        notification.setDeliveryStatus(result.deliveryStatus());
        notification.setProviderMessageId(result.providerMessageId());
        notification.setProviderConversationId(result.providerConversationId());
        notification.setProviderStatus(result.providerStatus());
        notification.setProviderErrorCode(result.providerErrorCode());
        notification.setProviderErrorTitle(result.providerErrorTitle());
        notification.setLastStatusTimestamp(result.statusTimestamp());

        if (result.accepted()) {
            notification.setAcceptedTimestamp(result.statusTimestamp());
        } else if ("FAILED".equalsIgnoreCase(result.deliveryStatus())) {
            notification.setFailedTimestamp(result.statusTimestamp());
        }
    }

    private WhatsAppSendResult sendWhatsapp(SendNotificationRequest request, String address) {
        if (usesWhatsAppTemplate(request)) {
            return whatsAppSender.sendTemplate(
                    address,
                    request.getWhatsappTemplateName(),
                    request.getWhatsappTemplateLanguageCode(),
                    request.getWhatsappTemplateParameters()
            );
        }
        return whatsAppSender.sendText(address, request.getMessage());
    }

    private boolean usesWhatsAppTemplate(SendNotificationRequest request) {
        return trimToNull(request.getWhatsappTemplateName()) != null;
    }

    private void updateNotificationStatus(JsonNode statusNode) {
        String providerMessageId = trimToNull(statusNode.path("id").asText(null));
        if (providerMessageId == null) {
            return;
        }

        notificationRepository.findTopByProviderMessageIdOrderByCreationTimestampDesc(providerMessageId)
                .ifPresent(notification -> {
                    String providerStatus = trimToNull(statusNode.path("status").asText(null));
                    LocalDateTime statusTime = parseMetaTimestamp(statusNode.path("timestamp").asText(null));
                    notification.setProviderStatus(providerStatus);
                    notification.setLastStatusTimestamp(statusTime);

                    String conversationId = trimToNull(statusNode.path("conversation").path("id").asText(null));
                    if (conversationId != null) {
                        notification.setProviderConversationId(conversationId);
                    }

                    JsonNode errorNode = statusNode.path("errors").isArray() && statusNode.path("errors").size() > 0
                            ? statusNode.path("errors").get(0)
                            : null;
                    if (errorNode != null) {
                        notification.setProviderErrorCode(trimToNull(errorNode.path("code").asText(null)));
                        String errorTitle = trimToNull(errorNode.path("title").asText(null));
                        if (errorTitle == null) {
                            errorTitle = trimToNull(errorNode.path("message").asText(null));
                        }
                        notification.setProviderErrorTitle(errorTitle);
                    }

                    if (providerStatus != null) {
                        switch (providerStatus.toLowerCase()) {
                            case "sent" -> {
                                notification.setDeliveryStatus("SENT");
                                notification.setAcceptedTimestamp(notification.getAcceptedTimestamp() != null ? notification.getAcceptedTimestamp() : statusTime);
                            }
                            case "delivered" -> {
                                notification.setDeliveryStatus("DELIVERED");
                                notification.setDeliveredTimestamp(statusTime);
                            }
                            case "read" -> {
                                notification.setDeliveryStatus("READ");
                                notification.setReadTimestamp(statusTime);
                            }
                            case "failed" -> {
                                notification.setDeliveryStatus("FAILED");
                                notification.setFailedTimestamp(statusTime);
                            }
                            default -> notification.setDeliveryStatus(providerStatus.toUpperCase());
                        }
                    }

                    notificationRepository.save(notification);
                });
    }

    private LocalDateTime parseMetaTimestamp(String timestamp) {
        if (timestamp == null || timestamp.isBlank()) {
            return LocalDateTime.now();
        }
        try {
            return LocalDateTime.ofInstant(Instant.ofEpochSecond(Long.parseLong(timestamp)), ZoneId.systemDefault());
        } catch (NumberFormatException ignored) {
            return LocalDateTime.now();
        }
    }

    private String joinTemplateParameters(List<String> parameters) {
        if (parameters == null || parameters.isEmpty()) {
            return null;
        }
        return String.join(" | ", parameters.stream().map(value -> value == null ? "" : value).toList());
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private record ChannelTarget(String name, String address) {
    }
}
