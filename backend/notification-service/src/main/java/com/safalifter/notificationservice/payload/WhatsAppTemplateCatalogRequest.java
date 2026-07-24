package com.safalifter.notificationservice.payload;

import com.safalifter.notificationservice.enums.NotificationType;
import lombok.Data;

@Data
public class WhatsAppTemplateCatalogRequest {
    private NotificationType notificationType;
    private String templateName;
    private String languageCode;
    private Boolean enabled;
    private Boolean defaultTemplate;
    private String notes;
}
