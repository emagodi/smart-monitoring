package com.safalifter.authservice.service.impl;

import com.safalifter.authservice.entities.NotificationPreference;
import com.safalifter.authservice.entities.User;
import com.safalifter.authservice.enums.NotificationType;
import com.safalifter.authservice.payload.request.NotificationPreferenceUpdateItem;
import com.safalifter.authservice.payload.request.NotificationPreferenceUpdateRequest;
import com.safalifter.authservice.payload.response.NotificationPreferenceResponse;
import com.safalifter.authservice.payload.response.NotificationRecipientResponse;
import com.safalifter.authservice.repository.NotificationPreferenceRepository;
import com.safalifter.authservice.repository.UserRepository;
import com.safalifter.authservice.service.NotificationDirectoryService;
import com.safalifter.authservice.service.NotificationPreferenceService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class NotificationPreferenceServiceImpl implements NotificationPreferenceService {

    private final UserRepository userRepository;
    private final NotificationPreferenceRepository notificationPreferenceRepository;
    private final NotificationDirectoryService notificationDirectoryService;

    @Override
    @Transactional(readOnly = true)
    public List<NotificationPreferenceResponse> getPreferencesForUser(Long userId) {
        User user = getUser(userId);
        Map<NotificationType, NotificationPreference> stored = notificationPreferenceRepository
                .findAllByUserIdOrderByNotificationTypeAsc(userId)
                .stream()
                .collect(Collectors.toMap(NotificationPreference::getNotificationType, preference -> preference));

        List<NotificationPreferenceResponse> responses = new ArrayList<>();
        for (NotificationType type : NotificationType.values()) {
            responses.add(toResponse(resolvePreference(user, type, stored.get(type))));
        }
        return responses;
    }

    @Override
    public List<NotificationPreferenceResponse> updatePreferencesForUser(Long userId, NotificationPreferenceUpdateRequest request) {
        User user = getUser(userId);
        Map<NotificationType, NotificationPreference> stored = new EnumMap<>(NotificationType.class);
        notificationPreferenceRepository.findAllByUserIdOrderByNotificationTypeAsc(userId)
                .forEach(preference -> stored.put(preference.getNotificationType(), preference));

        if (request != null && request.getPreferences() != null) {
            for (NotificationPreferenceUpdateItem item : request.getPreferences()) {
                if (item == null || item.getNotificationType() == null) {
                    continue;
                }

                NotificationPreference preference = stored.computeIfAbsent(
                        item.getNotificationType(),
                        type -> NotificationPreference.builder()
                                .user(user)
                                .notificationType(type)
                                .supplierCode(resolveSupplierCode(user))
                                .build()
                );

                boolean allChannels = Boolean.TRUE.equals(item.getAllChannelsEnabled());
                preference.setAllChannelsEnabled(allChannels);
                preference.setMuted(Boolean.TRUE.equals(item.getMuted()));
                preference.setSupplierCode(normalize(item.getSupplierCode()) != null ? normalize(item.getSupplierCode()) : resolveSupplierCode(user));
                preference.setEmailEnabled(allChannels || Boolean.TRUE.equals(item.getEmailEnabled()));
                preference.setSmsEnabled(allChannels || Boolean.TRUE.equals(item.getSmsEnabled()));
                preference.setWhatsappEnabled(allChannels || Boolean.TRUE.equals(item.getWhatsappEnabled()));
                stored.put(preference.getNotificationType(), notificationPreferenceRepository.save(preference));
            }
        }

        return getPreferencesForUser(userId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<NotificationRecipientResponse> resolveRecipients(NotificationType notificationType, String supplierCode) {
        String normalizedSupplier = normalize(supplierCode);
        List<NotificationRecipientResponse> userRecipients = userRepository.findAllWithIam().stream()
                .filter(user -> user.isEnabled())
                .filter(user -> matchesSupplier(user, normalizedSupplier))
                .map(user -> toRecipientResponse(user, resolveStoredPreference(user.getId(), notificationType)))
                .filter(response -> !response.isMuted())
                .filter(response -> response.isAllChannelsEnabled() || response.isEmailEnabled() || response.isSmsEnabled() || response.isWhatsappEnabled())
                .sorted(Comparator.comparing(NotificationRecipientResponse::getFirstname, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)))
                .toList();

        List<NotificationRecipientResponse> recipients = new ArrayList<>(userRecipients);
        recipients.addAll(notificationDirectoryService.resolveDirectoryRecipients(notificationType, normalizedSupplier));
        return recipients;
    }

    private NotificationPreference resolvePreference(User user, NotificationType type, NotificationPreference stored) {
        if (stored != null) {
            return stored;
        }
        return NotificationPreference.builder()
                .user(user)
                .notificationType(type)
                .supplierCode(resolveSupplierCode(user))
                .emailEnabled(true)
                .smsEnabled(false)
                .whatsappEnabled(false)
                .allChannelsEnabled(false)
                .muted(false)
                .build();
    }

    private NotificationPreference resolveStoredPreference(Long userId, NotificationType type) {
        return notificationPreferenceRepository.findAllByUserIdOrderByNotificationTypeAsc(userId).stream()
                .filter(preference -> preference.getNotificationType() == type)
                .findFirst()
                .orElse(null);
    }

    private NotificationPreferenceResponse toResponse(NotificationPreference preference) {
        return NotificationPreferenceResponse.builder()
                .notificationType(preference.getNotificationType())
                .emailEnabled(preference.isEmailEnabled())
                .smsEnabled(preference.isSmsEnabled())
                .whatsappEnabled(preference.isWhatsappEnabled())
                .allChannelsEnabled(preference.isAllChannelsEnabled())
                .muted(preference.isMuted())
                .supplierCode(preference.getSupplierCode())
                .build();
    }

    private NotificationRecipientResponse toRecipientResponse(User user, NotificationPreference preference) {
        NotificationPreference effective = resolvePreference(user, preference != null ? preference.getNotificationType() : NotificationType.SYSTEM_NOTICE, preference);
        return NotificationRecipientResponse.builder()
                .userId(user.getId())
                .firstname(user.getFirstname())
                .lastname(user.getLastname())
                .email(user.getEmail())
                .phone(user.getPhone())
                .whatsappNumber(user.getWhatsappNumber())
                .supplierCode(user.getSupplier() != null ? user.getSupplier().getCode() : null)
                .supplierName(user.getSupplier() != null ? user.getSupplier().getName() : null)
                .userType(user.getUserType() != null ? user.getUserType().getName() : null)
                .notificationType(effective.getNotificationType())
                .emailEnabled(effective.isAllChannelsEnabled() || effective.isEmailEnabled())
                .smsEnabled(effective.isAllChannelsEnabled() || effective.isSmsEnabled())
                .whatsappEnabled(effective.isAllChannelsEnabled() || effective.isWhatsappEnabled())
                .allChannelsEnabled(effective.isAllChannelsEnabled())
                .muted(effective.isMuted())
                .build();
    }

    private boolean matchesSupplier(User user, String supplierCode) {
        if (supplierCode == null || supplierCode.isBlank()) {
            return true;
        }
        if (user.getSupplier() == null || user.getSupplier().getCode() == null) {
            return false;
        }
        return supplierCode.equalsIgnoreCase(user.getSupplier().getCode());
    }

    private String resolveSupplierCode(User user) {
        return user.getSupplier() != null ? normalize(user.getSupplier().getCode()) : null;
    }

    private User getUser(Long userId) {
        return userRepository.findDetailedById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed.toLowerCase(Locale.ROOT);
    }
}
