package com.safalifter.authservice.service.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import com.safalifter.authservice.entities.SmsEntity;
import com.safalifter.authservice.repository.SmsRepository;
import com.safalifter.authservice.service.SmsService;

@Component
@RequiredArgsConstructor
@Slf4j
public class SmsAsyncSender {

    private final SmsService smsService;
    private final SmsRepository smsRepository;

    @Async
    public void sendAsync(SmsEntity sms) {
        log.info("Sending SMS ID {} to {}", sms.getId(), sms.getPhone());
        boolean success = smsService.sendSms(sms.getPhone(), sms.getMessage());
        if (success) {
            sms.setSent(true);
            sms.setSentAt(java.time.LocalDateTime.now());
            smsRepository.save(sms);
            log.info("SMS ID {} sent successfully", sms.getId());
        } else {
            sms.setRetryCount(sms.getRetryCount() + 1);
            smsRepository.save(sms);
            log.warn("SMS ID {} failed to send. Retry count: {}", sms.getId(), sms.getRetryCount());
        }
    }
}
