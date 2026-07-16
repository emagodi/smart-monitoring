package com.safalifter.notificationservice.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

@Component
@RequiredArgsConstructor
public class EwsEmailSender {
    @Value("${ews.url}")
    private String ewsUrl;
    @Value("${ews.username}")
    private String username;
    @Value("${ews.password}")
    private String password;

    private final RestTemplate restTemplate = new RestTemplate();

    public void send(String to, String subject, String body) {
        if (ewsUrl == null || ewsUrl.isBlank() || username == null || username.isBlank() || password == null || password.isBlank()) return;
        if (to == null || to.isBlank() || body == null || body.isBlank()) return;
        try {
            String soap = buildSoapEnvelope(to, subject != null ? subject : "Notification", body);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.TEXT_XML);
            String creds = username + ":" + password;
            String basic = Base64.getEncoder().encodeToString(creds.getBytes(StandardCharsets.UTF_8));
            headers.add("Authorization", "Basic " + basic);
            HttpEntity<String> req = new HttpEntity<>(soap, headers);
            restTemplate.postForEntity(ewsUrl, req, String.class);
        } catch (Exception ignored) {}
    }

    private String buildSoapEnvelope(String to, String subject, String body) {
        return "<?xml version=\"1.0\" encoding=\"utf-8\"?>" +
                "<soap:Envelope xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\" xmlns:t=\"http://schemas.microsoft.com/exchange/services/2006/types\">" +
                "<soap:Body>" +
                "<CreateItem xmlns=\"http://schemas.microsoft.com/exchange/services/2006/messages\" MessageDisposition=\"SendAndSaveCopy\">" +
                "<SavedItemFolderId><t:DistinguishedFolderId Id=\"sentitems\"/></SavedItemFolderId>" +
                "<Items><t:Message>" +
                "<t:Subject" + ">" + escape(subject) + "</t:Subject>" +
                "<t:Body BodyType=\"Text\">" + escape(body) + "</t:Body>" +
                "<t:ToRecipients><t:Mailbox><t:EmailAddress>" + escape(to) + "</t:EmailAddress></t:Mailbox></t:ToRecipients>" +
                "</t:Message></Items></CreateItem></soap:Body></soap:Envelope>";
    }

    private String escape(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}