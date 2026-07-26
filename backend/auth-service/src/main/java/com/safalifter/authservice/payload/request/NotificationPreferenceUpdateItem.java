package com.safalifter.authservice.payload.request;

import com.safalifter.authservice.enums.NotificationType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationPreferenceUpdateItem {
    private NotificationType notificationType;
    private Boolean emailEnabled;
    private Boolean smsEnabled;
    private Boolean whatsappEnabled;
    private Boolean allChannelsEnabled;
    private Boolean muted;
    private String supplierCode;
}
