package com.safalifter.transformerservice.service.impl;

import com.safalifter.transformerservice.entities.SmsNotification;
import com.safalifter.transformerservice.enums.SmsStatus;
import com.safalifter.transformerservice.repository.SmsNotificationRepository;
import com.safalifter.transformerservice.service.SmsSender;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class SmsSenderImpl implements SmsSender {

    private final SmsNotificationRepository smsNotificationRepository;
    private final RestTemplate restTemplate;

    @Value("${powertel.sms.api.url}")
    private String smsApiUrl;

    @Value("${powertel.sms.api.key}")
    private String smsApiKey;

    @Override
    @Async
    public void sendAsync(SmsNotification sms) {
        try {
            log.info("Attempting to send SMS to {} (Attempt: {})", sms.getPhoneNumber(), sms.getRetryCount() + 1);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(smsApiKey);

            Map<String, Object> body = new HashMap<>();
            body.put("to", Collections.singletonList(sms.getPhoneNumber()));
            body.put("message", sms.getMessage());

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

            // Sending request
            restTemplate.postForObject(smsApiUrl, request, String.class);

            // If no exception, assume success
            sms.setStatus(SmsStatus.SENT);
            smsNotificationRepository.save(sms);
            log.info("SMS sent successfully to {}", sms.getPhoneNumber());

        } catch (Exception e) {
            log.error("Failed to send SMS to {}: {}", sms.getPhoneNumber(), e.getMessage());
            handleFailure(sms);
        }
    }

    private void handleFailure(SmsNotification sms) {
        int retryCount = sms.getRetryCount() + 1;
        sms.setRetryCount(retryCount);

        if (retryCount == 1) {
            sms.setNextRetryTime(LocalDateTime.now().plusMinutes(5));
            sms.setStatus(SmsStatus.RETRYING);
        } else if (retryCount == 2) {
            sms.setNextRetryTime(LocalDateTime.now().plusMinutes(30));
            sms.setStatus(SmsStatus.RETRYING);
        } else if (retryCount == 3) {
            sms.setNextRetryTime(LocalDateTime.now().plusHours(1));
            sms.setStatus(SmsStatus.RETRYING);
        } else {
            sms.setStatus(SmsStatus.FAILED);
            sms.setNextRetryTime(null);
            log.warn("SMS to {} failed after max retries", sms.getPhoneNumber());
        }
        smsNotificationRepository.save(sms);
    }
}
