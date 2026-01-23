package com.safalifter.transformerservice.service;

import com.safalifter.transformerservice.entities.Alert;

public interface SmsService {
    void sendAlertSms(Alert alert);
    void retryFailedSms();
}
