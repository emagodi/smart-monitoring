package com.safalifter.transformerservice.reaction;

import com.safalifter.transformerservice.clients.NotificationClient;
import com.safalifter.transformerservice.payload.client.NotificationType;
import com.safalifter.transformerservice.payload.client.SendNotificationRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * Pages the Loss Control staff on duty for the alert's depot (SMS / WhatsApp / e-mail as each person chose), with the
 * alert number so they can acknowledge straight from WhatsApp ("ACK 1234"), USSD or the web desk.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DutyNotifier {

    private final DutyService dutyService;
    private final NotificationClient notificationClient;

    @Value("${app.public-base-url:http://154.73.80.22}")
    private String publicBaseUrl;

    @Async
    public void pageOnDuty(Long alertId, Long depotId, String transformerName, String what, String location, List<String> whatsappTemplateParameters, boolean repeat, int occurrences) {
        List<Map<String, Object>> people = dutyService.onDutyFor(depotId);
        if (people.isEmpty()) {
            log.debug("No Loss Control staff on duty for depot {}; alert {} goes to the Response Desk only", depotId, alertId);
            return;
        }
        String link = publicBaseUrl.replaceAll("/+$", "") + "/response?alert=" + alertId;
        String text = (repeat ? "REPEATED ALERT" : "INTRUSION ALERT") + " #" + alertId + ": " + nz(what, "security event") + " at " + nz(transformerName, "a transformer")
                + (location != null ? " (" + location + ")" : "") + (repeat ? ", " + occurrences + " events, still open" : "")
                + ". Reply ACK " + alertId + " to acknowledge, ARRIVED " + alertId + " when on site, CLOSE " + alertId + " FALSE/REAL/FAULT to close. " + link;
        for (Map<String, Object> p : people) {
            boolean sms = DutyService.truthy(p.get("notify_sms")) && notBlank(p.get("phone"));
            boolean wa = DutyService.truthy(p.get("notify_whatsapp")) && notBlank(p.get("whatsapp"));
            boolean email = DutyService.truthy(p.get("notify_email")) && notBlank(p.get("user_email"));
            if (!sms && !wa && !email) continue;
            try {
                notificationClient.send(SendNotificationRequest.builder()
                        .notificationType(NotificationType.CONTROLLER_TRIGGER)
                        .depotId(depotId)
                        .sourceSystem("transformer-service:duty")
                        .referenceId(String.valueOf(alertId))
                        .userId(p.get("user_id") != null ? String.valueOf(p.get("user_id")) : null)
                        .recipientName((String) p.get("user_name"))
                        .phone(sms ? (String) p.get("phone") : null)
                        .whatsappNumber(wa ? (String) p.get("whatsapp") : null)
                        .email(email ? (String) p.get("user_email") : null)
                        .subject((repeat ? "Repeated alert #" : "Alert #") + alertId + " · " + nz(transformerName, ""))
                        .message(text)
                        .whatsappTemplateParameters(whatsappTemplateParameters)
                        .build());
            } catch (Exception e) {
                log.warn("Could not page {} for alert {}: {}", p.get("user_email"), alertId, e.getMessage());
            }
        }
        log.info("Alert {} paged to {} on-duty Loss Control staff of depot {}", alertId, people.size(), depotId);
    }

    private static boolean notBlank(Object o) {
        return o != null && !o.toString().isBlank();
    }

    private static String nz(String s, String d) {
        return s == null || s.isBlank() ? d : s;
    }
}
