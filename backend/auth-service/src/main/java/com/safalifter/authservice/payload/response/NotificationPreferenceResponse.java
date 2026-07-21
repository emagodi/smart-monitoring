package com.safalifter.authservice.payload.response;

import com.safalifter.authservice.enums.NotificationType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationPreferenceResponse {
    private NotificationType notificationType;
    private boolean emailEnabled;
    private boolean smsEnabled;
    private boolean whatsappEnabled;
    private boolean allChannelsEnabled;
    private boolean muted;
    private String supplierCode;
}
