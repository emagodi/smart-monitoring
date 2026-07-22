package com.safalifter.authservice.payload.response;

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
public class NotificationDirectoryWorkspaceResponse {
    private boolean canManageAllSuppliers;
    private String activeSupplierCode;
    private String activeSupplierName;
    private List<NotificationSupplierScopeResponse> suppliers;
    private List<NotificationDirectoryEntryResponse> entries;
    private List<NotificationType> availableNotificationTypes;
    private List<NotificationChannel> availableChannels;
}
