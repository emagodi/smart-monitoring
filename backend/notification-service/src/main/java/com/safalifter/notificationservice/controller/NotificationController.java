package com.safalifter.notificationservice.controller;

import com.safalifter.notificationservice.model.Notification;
import com.safalifter.notificationservice.service.NotificationService;
import com.safalifter.notificationservice.request.SendNotificationRequest;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/v1/notification")
@RequiredArgsConstructor
public class NotificationController {
    private final NotificationService notificationService;

    @Value("${whatsapp.verify-token:}")
    private String whatsappVerifyToken;

    @GetMapping("/getAllByUserId/{userId}")
    public ResponseEntity<List<Notification>> getAllByUserId(@PathVariable String userId) {
        return ResponseEntity.ok(notificationService.getAllByUserId(userId));
    }

    @PostMapping("/send")
    public ResponseEntity<Void> send(@RequestBody SendNotificationRequest request) {
        notificationService.save(request);
        return ResponseEntity.accepted().build();
    }

    @GetMapping("/whatsapp/webhook")
    public ResponseEntity<String> verifyWhatsAppWebhook(
            @RequestParam(name = "hub.mode", required = false) String mode,
            @RequestParam(name = "hub.verify_token", required = false) String verifyToken,
            @RequestParam(name = "hub.challenge", required = false) String challenge
    ) {
        if ("subscribe".equalsIgnoreCase(mode) && whatsappVerifyToken != null && whatsappVerifyToken.equals(verifyToken)) {
            return ResponseEntity.ok(challenge != null ? challenge : "");
        }
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Verification failed");
    }

    @PostMapping("/whatsapp/webhook")
    public ResponseEntity<Void> handleWhatsAppWebhook(@RequestBody JsonNode payload) {
        notificationService.handleWhatsAppWebhook(payload);
        return ResponseEntity.ok().build();
    }
}
