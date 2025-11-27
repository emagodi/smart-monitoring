package com.safalifter.authservice.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final SmsQueueProcessor smsQueueProcessor;

    public void sendOtpSms(String phone, String otp) {
        String msg = "Your Powertel OTP is: " + otp;
        smsQueueProcessor.queueSms(phone, msg);
    }
}
