package com.safalifter.notificationservice.payload;

import com.safalifter.notificationservice.enums.NotificationType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WhatsAppTemplateCatalogResponse {
    private Long id;
    private NotificationType notificationType;
    private String templateName;
    private String languageCode;
    private Boolean enabled;
    private Boolean defaultTemplate;
    private String notes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
