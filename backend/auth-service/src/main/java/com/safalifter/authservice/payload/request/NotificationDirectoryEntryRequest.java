package com.safalifter.authservice.payload.request;

import com.safalifter.authservice.enums.NotificationChannel;
import com.safalifter.authservice.enums.NotificationType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationDirectoryEntryRequest {
    private String supplierCode;
    private String displayName;
    private NotificationChannel channel;
    private String destination;
    private Boolean enabled;
    private Boolean allNotificationTypes;
    private List<NotificationType> notificationTypes;
    private String notes;
}
