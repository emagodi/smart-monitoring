package com.safalifter.transformerservice.service.impl;

import com.safalifter.transformerservice.entities.EmailNotification;
import com.safalifter.transformerservice.enums.EmailStatus;
import com.safalifter.transformerservice.repository.EmailNotificationRepository;
import com.safalifter.transformerservice.service.EmailSender;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import microsoft.exchange.webservices.data.core.ExchangeService;
import microsoft.exchange.webservices.data.core.enumeration.misc.ExchangeVersion;
import microsoft.exchange.webservices.data.core.service.item.EmailMessage;
import microsoft.exchange.webservices.data.credential.WebCredentials;
import microsoft.exchange.webservices.data.property.complex.MessageBody;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailSenderImpl implements EmailSender {

    private final EmailNotificationRepository emailNotificationRepository;

    @Value("${ews.username}")
    private String username;

    @Value("${ews.password}")
    private String password;

    @Value("${ews.url}")
    private String url;

    @Override
    @Async
    public void sendAsync(EmailNotification emailNotification) {
        log.info("Attempting to send Email to {} (Attempt: {})", emailNotification.getEmail(), emailNotification.getRetryCount() + 1);
        try {
            ExchangeService service = new ExchangeService(ExchangeVersion.Exchange2010_SP2);
            service.setCredentials(new WebCredentials(username, password));
            service.setUrl(new URI(url));

            EmailMessage msg = new EmailMessage(service);
            msg.setSubject(emailNotification.getSubject());
            msg.setBody(MessageBody.getMessageBodyFromText(emailNotification.getMessage()));
            msg.getToRecipients().add(emailNotification.getEmail());
            msg.send();

            emailNotification.setStatus(EmailStatus.SENT);
            emailNotificationRepository.save(emailNotification);
            log.info("Email sent successfully to {}", emailNotification.getEmail());

        } catch (Exception e) {
            log.error("Failed to send Email to {}: {}", emailNotification.getEmail(), e.getMessage());
            handleFailure(emailNotification);
        }
    }

    private void handleFailure(EmailNotification emailNotification) {
        int retryCount = emailNotification.getRetryCount() + 1;
        emailNotification.setRetryCount(retryCount);

        if (retryCount == 1) {
            emailNotification.setNextRetryTime(LocalDateTime.now().plusMinutes(5));
            emailNotification.setStatus(EmailStatus.RETRYING);
        } else if (retryCount == 2) {
            emailNotification.setNextRetryTime(LocalDateTime.now().plusMinutes(30));
            emailNotification.setStatus(EmailStatus.RETRYING);
        } else if (retryCount == 3) {
            emailNotification.setNextRetryTime(LocalDateTime.now().plusHours(1));
            emailNotification.setStatus(EmailStatus.RETRYING);
        } else {
            emailNotification.setStatus(EmailStatus.FAILED);
            emailNotification.setNextRetryTime(null);
            log.warn("Email to {} failed after max retries", emailNotification.getEmail());
        }
        emailNotificationRepository.save(emailNotification);
    }
}
