package com.safalifter.transformerservice.service.impl;

import com.safalifter.transformerservice.client.AuthClient;
import com.safalifter.transformerservice.payload.response.UserResponse;
import com.safalifter.transformerservice.entities.Alert;
import com.safalifter.transformerservice.entities.SmsNotification;
import com.safalifter.transformerservice.enums.Role;
import com.safalifter.transformerservice.enums.SmsStatus;
import com.safalifter.transformerservice.repository.AlertRepository;
import com.safalifter.transformerservice.repository.SmsNotificationRepository;
import com.safalifter.transformerservice.service.SmsSender;
import com.safalifter.transformerservice.service.SmsService;
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
public class SmsServiceImpl implements SmsService {

    private final SmsNotificationRepository smsNotificationRepository;
    private final AlertRepository alertRepository;
    private final AuthClient authClient;
    private final SmsSender smsSender;

    @Override
    public void sendAlertSms(Alert alert) {
        try {
            log.info("Preparing to send SMS for alert ID: {}", alert.getId());

            String message = String.format("Alert: %s. Transformer: %s. Value: %s. Location: %s",
                    alert.getMessage(), 
                    alert.getTransformerName() != null ? alert.getTransformerName() : "N/A", 
                    alert.getValue(), 
                    alert.getDepotName() != null ? alert.getDepotName() : "N/A");

            // Since we need to find users by depot, and we have depotId in Alert
            if (alert.getDepotId() != null) {
                log.info("Fetching LOSS_CONTROL users for depotId: {}", alert.getDepotId());
                List<UserResponse> users = authClient.getUsersByRoleAndDepot(Role.LOSS_CONTROL, alert.getDepotId());
                if (users != null && !users.isEmpty()) {
                    for (UserResponse user : users) {
                        if (user.getPhone() != null && !user.getPhone().isEmpty()) {
                            log.info("Sending SMS to LOSS_CONTROL user: {}", user.getEmail());
                            createAndSendSms(user.getPhone(), message, alert.getId());
                        } else {
                            log.warn("User {} has no phone number, skipping SMS", user.getEmail());
                        }
                    }
                } else {
                    log.info("No LOSS_CONTROL users found for depotId: {}", alert.getDepotId());
                }
            } else {
                log.warn("Alert {} has no depotId, skipping role-based SMS", alert.getId());
            }

        } catch (Exception e) {
            log.error("Error triggering SMS for alert: {}", alert.getId(), e);
        }
    }

    private void createAndSendSms(String phoneNumber, String message, Long alertId) {
        SmsNotification sms = SmsNotification.builder()
                .phoneNumber(phoneNumber)
                .message(message)
                .status(SmsStatus.PENDING)
                .retryCount(0)
                .nextRetryTime(LocalDateTime.now())
                .alertId(alertId)
                .build();
        sms = smsNotificationRepository.save(sms);
        final SmsNotification finalSms = sms;
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    smsSender.sendAsync(finalSms);
                }
            });
        } else {
            smsSender.sendAsync(finalSms);
        }
    }

    @Scheduled(fixedRate = 60000) // Check every minute
    public void retryFailedSms() {
        List<SmsStatus> statuses = Arrays.asList(SmsStatus.PENDING, SmsStatus.FAILED);
        List<SmsNotification> notifications = smsNotificationRepository.findByStatusInAndNextRetryTimeBefore(statuses, LocalDateTime.now());

        for (SmsNotification sms : notifications) {
            smsSender.sendAsync(sms);
        }
    }

    @Scheduled(initialDelay = 10000, fixedRate = 300000) // Check 10s after start, then every 5 mins
    public void processMissingSms() {
        try {
            List<Alert> recentAlerts = alertRepository.findTop50ByOrderByCreatedAtDesc();
            int count = 0;
            for (Alert alert : recentAlerts) {
                if (!smsNotificationRepository.existsByAlertId(alert.getId())) {
                    log.info("Found alert {} without SMS record. Triggering SMS now.", alert.getId());
                    sendAlertSms(alert);
                    count++;
                }
            }
            if (count > 0) {
                log.info("Triggered SMS for {} missing alerts.", count);
            }
        } catch (Exception e) {
            log.error("Error in processMissingSms: {}", e.getMessage());
        }
    }
}
