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
public class NotificationRecipientResponse {
    private Long userId;
    private String firstname;
    private String lastname;
    private String email;
    private String phone;
    private String whatsappNumber;
    private String supplierCode;
    private String supplierName;
    private Long depotId;
    private String userType;
    private NotificationType notificationType;
    private boolean emailEnabled;
    private boolean smsEnabled;
    private boolean whatsappEnabled;
    private boolean allChannelsEnabled;
    private boolean muted;
}
