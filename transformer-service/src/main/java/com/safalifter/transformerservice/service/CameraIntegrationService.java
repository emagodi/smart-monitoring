package com.safalifter.transformerservice.service;

import org.springframework.messaging.Message;

public interface CameraIntegrationService {
    void processCameraMessage(Message<?> message);
}
