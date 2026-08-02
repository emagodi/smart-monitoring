package com.safalifter.authservice.service;

import com.safalifter.authservice.enums.NotificationType;
import com.safalifter.authservice.payload.request.NotificationPreferenceUpdateRequest;
import com.safalifter.authservice.payload.response.NotificationPreferenceResponse;
import com.safalifter.authservice.payload.response.NotificationRecipientResponse;

import java.util.List;

public interface NotificationPreferenceService {
    List<NotificationPreferenceResponse> getPreferencesForUser(Long userId);

    List<NotificationPreferenceResponse> updatePreferencesForUser(Long userId, NotificationPreferenceUpdateRequest request);

    List<NotificationRecipientResponse> resolveRecipients(NotificationType notificationType, String supplierCode, Long depotId);
}
