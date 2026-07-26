package com.safalifter.authservice.payload.response;

import com.safalifter.authservice.enums.NotificationChannel;
import com.safalifter.authservice.enums.NotificationType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationDirectoryEntryResponse {
    private Long id;
    private String supplierCode;
    private String supplierName;
    private String displayName;
    private NotificationChannel channel;
    private String destination;
    private boolean enabled;
    private boolean allNotificationTypes;
    private List<NotificationType> notificationTypes;
    private String notes;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
