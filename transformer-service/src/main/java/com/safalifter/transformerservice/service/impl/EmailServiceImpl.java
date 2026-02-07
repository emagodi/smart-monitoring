package com.safalifter.transformerservice.service.impl;

import com.safalifter.transformerservice.client.AuthClient;
import com.safalifter.transformerservice.entities.Alert;
import com.safalifter.transformerservice.entities.EmailNotification;
import com.safalifter.transformerservice.enums.EmailStatus;
import com.safalifter.transformerservice.enums.Role;
import com.safalifter.transformerservice.payload.response.UserResponse;
import com.safalifter.transformerservice.repository.AlertRepository;
import com.safalifter.transformerservice.repository.EmailNotificationRepository;
import com.safalifter.transformerservice.service.EmailSender;
import com.safalifter.transformerservice.service.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailServiceImpl implements EmailService {

    private final EmailNotificationRepository emailNotificationRepository;
    private final AlertRepository alertRepository;
    private final AuthClient authClient;
    private final EmailSender emailSender;

    @Override
    public void sendAlertEmail(Alert alert) {
        try {
            log.info("Preparing to send Email for alert ID: {}", alert.getId());

            String subject = String.format("Alert: %s - %s", 
                    alert.getTransformerName() != null ? alert.getTransformerName() : "Unknown Transformer",
                    alert.getMessage());

            String message = String.format("Alert Details:\n\nMessage: %s\nTransformer: %s\nValue: %s\nLocation: %s\nDate: %s",
                    alert.getMessage(),
                    alert.getTransformerName() != null ? alert.getTransformerName() : "N/A",
                    alert.getValue(),
                    alert.getDepotName() != null ? alert.getDepotName() : "N/A",
                    alert.getCreatedAt() != null ? alert.getCreatedAt().toString() : LocalDateTime.now().toString());

            // Since we need to find users by depot, and we have depotId in Alert
            if (alert.getDepotId() != null) {
                log.info("Fetching LOSS_CONTROL users for depotId: {}", alert.getDepotId());
                List<UserResponse> users = authClient.getUsersByRoleAndDepot(Role.LOSS_CONTROL, alert.getDepotId());
                if (users != null && !users.isEmpty()) {
                    for (UserResponse user : users) {
                        if (user.getEmail() != null && !user.getEmail().isEmpty()) {
                            log.info("Sending Email to LOSS_CONTROL user: {}", user.getEmail());
                            createAndSendEmail(user.getEmail(), subject, message, alert.getId());
                        } else {
                            log.warn("User {} has no email address, skipping Email", user.getFirstname());
                        }
                    }
                } else {
                    log.info("No LOSS_CONTROL users found for depotId: {}", alert.getDepotId());
                }
            } else {
                log.warn("Alert {} has no depotId, skipping role-based Email", alert.getId());
            }

        } catch (Exception e) {
            log.error("Error triggering Email for alert: {}", alert.getId(), e);
        }
    }

    private void createAndSendEmail(String email, String subject, String message, Long alertId) {
        EmailNotification emailNotification = EmailNotification.builder()
                .email(email)
                .subject(subject)
                .message(message)
                .status(EmailStatus.PENDING)
                .retryCount(0)
                .nextRetryTime(LocalDateTime.now())
                .alertId(alertId)
                .build();
        emailNotification = emailNotificationRepository.save(emailNotification);
        
        final EmailNotification finalEmail = emailNotification;
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    emailSender.sendAsync(finalEmail);
                }
            });
        } else {
            emailSender.sendAsync(finalEmail);
        }
    }

    @Override
    @Scheduled(fixedRate = 60000) // Check every minute
    public void retryFailedEmail() {
        // Include RETRYING status as well since our sender logic sets it
        List<EmailStatus> statuses = Arrays.asList(EmailStatus.PENDING, EmailStatus.FAILED, EmailStatus.RETRYING);
        List<EmailNotification> notifications = emailNotificationRepository.findByStatusInAndNextRetryTimeBefore(statuses, LocalDateTime.now());

        if (!notifications.isEmpty()) {
            log.info("Retrying {} failed/pending emails", notifications.size());
            for (EmailNotification email : notifications) {
                emailSender.sendAsync(email);
            }
        }
    }

    @Scheduled(initialDelay = 10000, fixedRate = 300000) // Check 10s after start, then every 5 mins
    public void processMissingEmail() {
        try {
            List<Alert> recentAlerts = alertRepository.findTop50ByOrderByCreatedAtDesc();
            int count = 0;
            for (Alert alert : recentAlerts) {
                if (!emailNotificationRepository.existsByAlertId(alert.getId())) {
                    log.info("Found alert {} without Email record. Triggering Email now.", alert.getId());
                    sendAlertEmail(alert);
                    count++;
                }
            }
            if (count > 0) {
                log.info("Triggered Email for {} missing alerts.", count);
            }
        } catch (Exception e) {
            log.error("Error in processMissingEmail: {}", e.getMessage());
        }
    }
}
