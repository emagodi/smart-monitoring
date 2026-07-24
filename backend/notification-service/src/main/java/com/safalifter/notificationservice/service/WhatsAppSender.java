package com.safalifter.notificationservice.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.HttpStatusCodeException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class WhatsAppSender {

    @Value("${whatsapp.api.url:}")
    private String whatsappApiUrl;

    @Value("${whatsapp.api.token:}")
    private String whatsappApiToken;

    @Value("${whatsapp.business.number:}")
    private String businessNumber;

    @Value("${whatsapp.phone-number-id:}")
    private String phoneNumberId;

    @Value("${whatsapp.api-version:v25.0}")
    private String apiVersion;

    @Value("${whatsapp.access-token:}")
    private String whatsappAccessToken;

    private final RestTemplate restTemplate = new RestTemplate();

    public WhatsAppSendResult sendText(String to, String message) {
        String resolvedUrl = resolveApiUrl();
        String resolvedToken = resolveAccessToken();
        if (resolvedUrl == null || resolvedUrl.isBlank() || resolvedToken == null || resolvedToken.isBlank()) {
            return WhatsAppSendResult.failed("CONFIGURATION_MISSING", "WhatsApp API configuration is incomplete", LocalDateTime.now(), "TEXT", null, "configuration missing");
        }
        if (to == null || to.isBlank() || message == null || message.isBlank()) {
            return WhatsAppSendResult.failed("INVALID_ARGUMENT", "Recipient and message are required for WhatsApp text sends", LocalDateTime.now(), "TEXT", null, "invalid text arguments");
        }

        Map<String, Object> body = new HashMap<>();
        body.put("messaging_product", "whatsapp");
        body.put("recipient_type", "individual");
        body.put("to", normalizeRecipient(to));
        body.put("type", "text");
        body.put("text", Map.of(
                "preview_url", false,
                "body", message
        ));
        return sendPayload(body, resolvedUrl, resolvedToken, "TEXT", null, "free-form window open");
    }

    public WhatsAppSendResult sendTemplate(String to, String templateName, String languageCode, List<String> parameters) {
        String resolvedUrl = resolveApiUrl();
        String resolvedToken = resolveAccessToken();
        if (resolvedUrl == null || resolvedUrl.isBlank() || resolvedToken == null || resolvedToken.isBlank()) {
            return WhatsAppSendResult.failed("CONFIGURATION_MISSING", "WhatsApp API configuration is incomplete", LocalDateTime.now(), "TEMPLATE", templateName, "configuration missing");
        }
        if (to == null || to.isBlank() || templateName == null || templateName.isBlank()) {
            return WhatsAppSendResult.failed("INVALID_ARGUMENT", "Recipient and template name are required for WhatsApp template sends", LocalDateTime.now(), "TEMPLATE", templateName, "invalid template arguments");
        }

        Map<String, Object> body = new HashMap<>();
        body.put("messaging_product", "whatsapp");
        body.put("recipient_type", "individual");
        body.put("to", normalizeRecipient(to));
        body.put("type", "template");
        body.put("template", buildTemplatePayload(templateName, languageCode, parameters));
        return sendPayload(body, resolvedUrl, resolvedToken, "TEMPLATE", templateName.trim(), "template required");
    }

    private String resolveApiUrl() {
        if (whatsappApiUrl != null && !whatsappApiUrl.isBlank()) {
            return whatsappApiUrl;
        }
        if (phoneNumberId == null || phoneNumberId.isBlank()) {
            return null;
        }
        String version = (apiVersion == null || apiVersion.isBlank()) ? "v25.0" : apiVersion.trim();
        return String.format(Locale.ROOT, "https://graph.facebook.com/%s/%s/messages", version, phoneNumberId.trim());
    }

    private String resolveAccessToken() {
        if (whatsappApiToken != null && !whatsappApiToken.isBlank()) {
            return whatsappApiToken;
        }
        return whatsappAccessToken;
    }

    private String normalizeRecipient(String value) {
        String normalized = value == null ? "" : value.replaceAll("[^0-9]", "");
        return normalized.isBlank() ? value : normalized;
    }

    @SuppressWarnings("unchecked")
    private WhatsAppSendResult sendPayload(
            Map<String, Object> body,
            String resolvedUrl,
            String resolvedToken,
            String payloadType,
            String templateName,
            String decisionReason
    ) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(resolvedToken);

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);
            ResponseEntity<Map> response = restTemplate.postForEntity(resolvedUrl, request, Map.class);
            Map<String, Object> responseBody = response.getBody();
            String providerMessageId = extractMessageId(responseBody);
            return WhatsAppSendResult.accepted(providerMessageId, LocalDateTime.now(), payloadType, templateName, decisionReason);
        } catch (HttpStatusCodeException ex) {
            return toFailureResult(ex.getResponseBodyAsString(), LocalDateTime.now(), payloadType, templateName, decisionReason);
        } catch (Exception ex) {
            return WhatsAppSendResult.failed("UNEXPECTED_ERROR", ex.getMessage(), LocalDateTime.now(), payloadType, templateName, decisionReason);
        }
    }

    private Map<String, Object> buildTemplatePayload(String templateName, String languageCode, List<String> parameters) {
        Map<String, Object> template = new HashMap<>();
        template.put("name", templateName.trim());
        template.put("language", Map.of(
                "code", (languageCode == null || languageCode.isBlank()) ? "en" : languageCode.trim()
        ));
        List<Map<String, Object>> components = buildTemplateComponents(parameters);
        if (!components.isEmpty()) {
            template.put("components", components);
        }
        return template;
    }

    private List<Map<String, Object>> buildTemplateComponents(List<String> parameters) {
        if (parameters == null || parameters.isEmpty()) {
            return Collections.emptyList();
        }
        List<Map<String, Object>> values = new ArrayList<>();
        for (String parameter : parameters) {
            values.add(Map.of(
                    "type", "text",
                    "text", parameter == null ? "" : parameter
            ));
        }
        return List.of(Map.of(
                "type", "body",
                "parameters", values
        ));
    }

    @SuppressWarnings("unchecked")
    private String extractMessageId(Map<String, Object> responseBody) {
        if (responseBody == null) {
            return null;
        }
        Object messagesObject = responseBody.get("messages");
        if (!(messagesObject instanceof List<?> messages) || messages.isEmpty()) {
            return null;
        }
        Object first = messages.get(0);
        if (!(first instanceof Map<?, ?> firstMap)) {
            return null;
        }
        Object id = firstMap.get("id");
        return id != null ? String.valueOf(id) : null;
    }

    @SuppressWarnings("unchecked")
    private WhatsAppSendResult toFailureResult(
            String responseBody,
            LocalDateTime fallbackTime,
            String payloadType,
            String templateName,
            String decisionReason
    ) {
        if (responseBody == null || responseBody.isBlank()) {
            return WhatsAppSendResult.failed("HTTP_ERROR", "WhatsApp API request failed", fallbackTime, payloadType, templateName, decisionReason);
        }
        try {
            Map<String, Object> parsed = parsedFallback(responseBody);
            Map<String, Object> error = parsed.get("error") instanceof Map<?, ?> value
                    ? (Map<String, Object>) value
                    : Collections.emptyMap();
            String errorCode = error.get("code") != null ? String.valueOf(error.get("code")) : "HTTP_ERROR";
            String errorTitle = error.get("message") != null ? String.valueOf(error.get("message")) : "WhatsApp API request failed";
            return WhatsAppSendResult.failed(errorCode, errorTitle, fallbackTime, payloadType, templateName, decisionReason);
        } catch (Exception ignored) {
            return WhatsAppSendResult.failed("HTTP_ERROR", responseBody, fallbackTime, payloadType, templateName, decisionReason);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> parsedFallback(String responseBody) {
        try {
            return new com.fasterxml.jackson.databind.ObjectMapper().readValue(responseBody, Map.class);
        } catch (Exception ignored) {
            return Collections.emptyMap();
        }
    }
}
