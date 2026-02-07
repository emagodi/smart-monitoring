package com.safalifter.transformerservice.service;

import com.safalifter.transformerservice.entities.Alert;

public interface EmailService {
    void sendAlertEmail(Alert alert);
    void retryFailedEmail();
}
