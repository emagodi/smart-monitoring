package com.safalifter.notificationservice.controller;

import com.safalifter.notificationservice.model.Notification;
import com.safalifter.notificationservice.payload.WhatsAppEligibilityResponse;
import com.safalifter.notificationservice.payload.WhatsAppTemplateCatalogRequest;
import com.safalifter.notificationservice.payload.WhatsAppTemplateCatalogResponse;
import com.safalifter.notificationservice.service.NotificationService;
import com.safalifter.notificationservice.request.SendNotificationRequest;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
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

    @GetMapping("/reference/{referenceId}")
    public ResponseEntity<List<Notification>> getAllByReferenceId(
            @PathVariable String referenceId,
            @RequestParam(required = false) String sourceSystem
    ) {
        return ResponseEntity.ok(notificationService.getAllByReferenceId(referenceId, sourceSystem));
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
    public ResponseEntity<Void> handleWhatsAppWebhook(
            @RequestBody String rawPayload,
            @RequestHeader(name = "X-Hub-Signature-256", required = false) String signatureHeader
    ) {
        if (!notificationService.verifyWebhookSignature(rawPayload, signatureHeader)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        JsonNode payload;
        try {
            payload = new com.fasterxml.jackson.databind.ObjectMapper().readTree(rawPayload);
        } catch (Exception ignored) {
            return ResponseEntity.badRequest().build();
        }
        notificationService.handleWhatsAppWebhook(payload);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/whatsapp/eligibility")
    public ResponseEntity<List<WhatsAppEligibilityResponse>> getWhatsAppEligibility() {
        return ResponseEntity.ok(notificationService.getWhatsAppEligibility());
    }

    @GetMapping("/whatsapp/eligibility/{waId}")
    public ResponseEntity<WhatsAppEligibilityResponse> getWhatsAppEligibility(@PathVariable String waId) {
        WhatsAppEligibilityResponse response = notificationService.getWhatsAppEligibility(waId);
        if (response == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(response);
    }

    @GetMapping("/whatsapp/templates")
    public ResponseEntity<List<WhatsAppTemplateCatalogResponse>> getWhatsAppTemplates() {
        return ResponseEntity.ok(notificationService.getWhatsAppTemplates());
    }

    @PostMapping(value = "/whatsapp/templates", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<WhatsAppTemplateCatalogResponse> createWhatsAppTemplate(@RequestBody WhatsAppTemplateCatalogRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(notificationService.createWhatsAppTemplate(request));
    }

    @PutMapping(value = "/whatsapp/templates/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<WhatsAppTemplateCatalogResponse> updateWhatsAppTemplate(
            @PathVariable Long id,
            @RequestBody WhatsAppTemplateCatalogRequest request
    ) {
        return ResponseEntity.ok(notificationService.updateWhatsAppTemplate(id, request));
    }

    @DeleteMapping("/whatsapp/templates/{id}")
    public ResponseEntity<Void> deleteWhatsAppTemplate(@PathVariable Long id) {
        notificationService.deleteWhatsAppTemplate(id);
        return ResponseEntity.noContent().build();
    }
}
