package com.safalifter.authservice.service.impl;

import com.safalifter.authservice.payload.request.SmsRequest;
import com.safalifter.authservice.service.SmsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.List;

@Service
@Slf4j
@RequiredArgsConstructor
public class SmsServiceImpl implements SmsService {

    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${powertel.sms.url}")
    private String smsUrl;

    @Value("${powertel.sms.api-key}")
    private String apiKey;

    @Override
    public boolean sendSms(String phone, String message) {
        try {
            SmsRequest smsRequest = new SmsRequest(
                    List.of(phone),  // phone is already in +263 format
                    message
            );

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", "Bearer " + apiKey); // Powertel requires Bearer token

            HttpEntity<SmsRequest> request = new HttpEntity<>(smsRequest, headers);

            ResponseEntity<String> response = restTemplate.exchange(
                    smsUrl,
                    HttpMethod.POST,
                    request,
                    String.class
            );

            log.info("SMS API Response: {}", response.getBody());
            return response.getStatusCode().is2xxSuccessful();

        } catch (Exception e) {
            log.error("Failed to send SMS", e);
            return false;
        }
    }


}
