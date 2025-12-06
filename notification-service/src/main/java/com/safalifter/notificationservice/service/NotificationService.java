package com.safalifter.notificationservice.service;

import com.safalifter.notificationservice.model.Notification;
import com.safalifter.notificationservice.repository.NotificationRepository;
import com.safalifter.notificationservice.request.SendNotificationRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class NotificationService {
    private final NotificationRepository notificationRepository;
    private final SmsSender smsSender;
    private final EwsEmailSender emailSender;

    @Value("${notification.default.sms.to:}")
    private String defaultSmsTo;
    @Value("${notification.default.email.to:}")
    private String defaultEmailTo;

    public void save(SendNotificationRequest request) {
        var notification = Notification.builder()
                .id(UUID.randomUUID().toString())
                .userId(request.getUserId())
                .offerId(request.getOfferId())
                .message(request.getMessage())
                .build();
        notificationRepository.save(notification);

        String smsTo = request.getPhone() != null && !request.getPhone().isBlank() ? request.getPhone() : defaultSmsTo;
        String emailTo = request.getEmail() != null && !request.getEmail().isBlank() ? request.getEmail() : defaultEmailTo;
        if (smsTo != null && !smsTo.isBlank()) {
            smsSender.send(smsTo, request.getMessage());
        }
        if (emailTo != null && !emailTo.isBlank()) {
            emailSender.send(emailTo, request.getSubject(), request.getMessage());
        }
    }

    public List<Notification> getAllByUserId(String id) {
        return notificationRepository.findAllByUserIdOrderByCreationTimestampDesc(id);
    }
}
