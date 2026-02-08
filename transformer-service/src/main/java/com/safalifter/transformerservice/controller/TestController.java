package com.safalifter.transformerservice.controller;

import com.safalifter.transformerservice.entities.EmailNotification;
import com.safalifter.transformerservice.enums.EmailStatus;
import com.safalifter.transformerservice.repository.EmailNotificationRepository;
import com.safalifter.transformerservice.service.EmailSender;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/v1/test")
@RequiredArgsConstructor
public class TestController {

    private final EmailSender emailSender;
    private final EmailNotificationRepository emailNotificationRepository;

    @PostMapping("/email")
    public String sendTestEmail(@RequestParam String to) {
        EmailNotification notification = EmailNotification.builder()
                .email(to)
                .subject("Test Alert from Smart Monitoring")
                .message("This is a test email from the Smart Monitoring EWS Integration test.")
                .status(EmailStatus.PENDING)
                .retryCount(0)
                .nextRetryTime(LocalDateTime.now())
                .alertId(0L) // Dummy alert ID
                .build();
        
        notification = emailNotificationRepository.save(notification);
        emailSender.sendAsync(notification);
        
        return "Test email queued for " + to + ". Check logs for status.";
    }
}
