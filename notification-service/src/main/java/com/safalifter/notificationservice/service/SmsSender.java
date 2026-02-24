package com.safalifter.notificationservice.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class SmsSender {
    @Value("${powertel.sms.url}")
    private String smsUrl;
    @Value("${powertel.sms.api-key}")
    private String apiKey;

    private final RestTemplate restTemplate = new RestTemplate();

    public void send(String to, String message) {
        if (smsUrl == null || smsUrl.isBlank() || apiKey == null || apiKey.isBlank()) return;
        if (to == null || to.isBlank() || message == null || message.isBlank()) return;
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            Map<String, Object> body = new HashMap<>();
            body.put("to", to);
            body.put("message", message);
            body.put("api_key", apiKey);
            HttpEntity<Map<String, Object>> req = new HttpEntity<>(body, headers);
            restTemplate.postForEntity(smsUrl, req, String.class);
        } catch (Exception ignored) {}
    }
}