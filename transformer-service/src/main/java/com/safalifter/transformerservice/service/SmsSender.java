package com.safalifter.transformerservice.service;

import com.safalifter.transformerservice.entities.SmsNotification;

public interface SmsSender {
    void sendAsync(SmsNotification sms);
}
