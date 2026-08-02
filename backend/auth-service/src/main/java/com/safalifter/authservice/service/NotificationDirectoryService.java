package com.safalifter.authservice.service;

import com.safalifter.authservice.enums.NotificationType;
import com.safalifter.authservice.payload.request.NotificationDirectoryEntryRequest;
import com.safalifter.authservice.payload.response.NotificationDirectoryEntryResponse;
import com.safalifter.authservice.payload.response.NotificationDirectoryWorkspaceResponse;
import com.safalifter.authservice.payload.response.NotificationRecipientResponse;
import org.springframework.security.core.Authentication;

import java.util.List;

public interface NotificationDirectoryService {
    NotificationDirectoryWorkspaceResponse getWorkspace(Authentication authentication, String supplierCode);

    NotificationDirectoryEntryResponse createEntry(Authentication authentication, NotificationDirectoryEntryRequest request);

    NotificationDirectoryEntryResponse updateEntry(Authentication authentication, Long entryId, NotificationDirectoryEntryRequest request);

    void deleteEntry(Authentication authentication, Long entryId);

    List<NotificationRecipientResponse> resolveDirectoryRecipients(NotificationType notificationType, String supplierCode, Long depotId);
}
