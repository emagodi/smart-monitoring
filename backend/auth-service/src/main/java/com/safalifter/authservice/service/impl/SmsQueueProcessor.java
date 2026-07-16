package com.safalifter.authservice.service.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import com.safalifter.authservice.entities.SmsEntity;
import com.safalifter.authservice.repository.SmsRepository;

import java.time.LocalDateTime;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class SmsQueueProcessor {

    private final SmsAsyncSender smsAsyncSender;
    private final SmsRepository smsRepository;

    public void queueSms(String phone, String message) {
        SmsEntity sms = SmsEntity.builder()
                .phone(phone)
                .message(message)
                .sent(false)
                .retryCount(0)
                .createdAt(LocalDateTime.now())
                .build();
        smsRepository.save(sms);
        log.info("SMS queued in database for {}: {}", phone, message);
    }

    @Scheduled(fixedDelay = 5000)
    public void processQueue() {
        List<SmsEntity> unsent = smsRepository.findBySentFalse();
        for (SmsEntity sms : unsent) {
            log.info("Processing SMS ID {} to {}", sms.getId(), sms.getPhone());
            try {
                smsAsyncSender.sendAsync(sms);
            } catch (Exception e) {
                log.error("Error sending SMS ID {}: {}", sms.getId(), e.getMessage());
            }
        }
    }
}
