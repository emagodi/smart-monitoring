package com.safalifter.transformerservice.service.impl;

import com.safalifter.transformerservice.service.CameraIntegrationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.Message;
import org.springframework.stereotype.Service;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.UUID;

@Service
@Slf4j
@RequiredArgsConstructor
public class CameraIntegrationServiceImpl implements CameraIntegrationService {

    private static final String UPLOAD_DIR = "/uploads/monitor/";

    @Override
    public void processCameraMessage(Message<?> message) {
        log.info("Received MQTT Message. Topic: {}", message.getHeaders().get("mqtt_receivedTopic"));
        
        try {
            Object payload = message.getPayload();
            log.info("Payload Type: {}", payload.getClass().getName());

            byte[] imageData = null;

            if (payload instanceof byte[]) {
                imageData = (byte[]) payload;
            } else if (payload instanceof String) {
                try {
                    imageData = Base64.getDecoder().decode((String) payload);
                    log.info("Decoded Base64 string payload");
                } catch (IllegalArgumentException e) {
                    log.warn("Payload is a string but not valid Base64");
                }
            }

            if (imageData != null && imageData.length > 0) {
                // Check if it's a valid JPEG (Starts with 0xFF 0xD8)
                if (imageData.length > 2 && (imageData[0] & 0xFF) == 0xFF && (imageData[1] & 0xFF) == 0xD8) {
                    log.info("Valid JPEG header detected. Size: {}", imageData.length);
                    saveImage(imageData);
                } else {
                    log.warn("Data received is NOT a valid JPEG. First bytes: [{}]", 
                        String.format("%02X %02X", imageData[0], imageData.length > 1 ? imageData[1] : 0));
                    // Optional: Save invalid data for debugging if needed, but avoiding it for now to keep folder clean
                }
            } else {
                log.info("Payload could not be converted to image data: {}", payload);
            }

        } catch (Exception e) {
            log.error("Error processing camera message", e);
        }
    }

    private void saveImage(byte[] imageData) throws Exception {
        String fileName = "snap_" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss")) + "_" + UUID.randomUUID() + ".jpg";
        Path path = Paths.get(UPLOAD_DIR + fileName);
        
        File directory = new File(UPLOAD_DIR);
        if (!directory.exists()) {
            directory.mkdirs();
        }
        
        Files.write(path, imageData);
        log.info("Saved image to: {}", path.toAbsolutePath());
        
        // TODO: Save to DB and trigger AI
    }
}
