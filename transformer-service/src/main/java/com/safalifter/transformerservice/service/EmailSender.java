package com.safalifter.transformerservice.service;

import com.safalifter.transformerservice.entities.EmailNotification;

public interface EmailSender {
    void sendAsync(EmailNotification emailNotification);
}
