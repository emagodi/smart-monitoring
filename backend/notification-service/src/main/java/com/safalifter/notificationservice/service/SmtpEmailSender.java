package com.safalifter.notificationservice.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class SmtpEmailSender {

    private final JavaMailSender javaMailSender;

    @Value("${spring.mail.host:}")
    private String smtpHost;

    @Value("${spring.mail.username:}")
    private String username;

    @Value("${notification.email.from:}")
    private String fromAddress;

    public boolean send(String to, String subject, String body) {
        if (smtpHost == null || smtpHost.isBlank() || username == null || username.isBlank()) {
            return false;
        }
        if (to == null || to.isBlank() || body == null || body.isBlank()) {
            return false;
        }
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(to);
            message.setFrom((fromAddress != null && !fromAddress.isBlank()) ? fromAddress : username);
            message.setSubject(subject != null && !subject.isBlank() ? subject : "Notification");
            message.setText(body);
            javaMailSender.send(message);
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }
}
