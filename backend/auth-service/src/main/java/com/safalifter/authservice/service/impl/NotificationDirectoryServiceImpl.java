package com.safalifter.authservice.service.impl;

import com.safalifter.authservice.entities.NotificationDirectoryEntry;
import com.safalifter.authservice.entities.SupplierEntity;
import com.safalifter.authservice.entities.User;
import com.safalifter.authservice.enums.NotificationChannel;
import com.safalifter.authservice.enums.NotificationType;
import com.safalifter.authservice.payload.request.NotificationDirectoryEntryRequest;
import com.safalifter.authservice.payload.response.NotificationDirectoryEntryResponse;
import com.safalifter.authservice.payload.response.NotificationDirectoryWorkspaceResponse;
import com.safalifter.authservice.payload.response.NotificationRecipientResponse;
import com.safalifter.authservice.payload.response.NotificationSupplierScopeResponse;
import com.safalifter.authservice.repository.NotificationDirectoryEntryRepository;
import com.safalifter.authservice.repository.SupplierRepository;
import com.safalifter.authservice.repository.UserRepository;
import com.safalifter.authservice.service.NotificationDirectoryService;
import com.safalifter.authservice.service.RbacAuthorizationService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Transactional
public class NotificationDirectoryServiceImpl implements NotificationDirectoryService {

    private final NotificationDirectoryEntryRepository notificationDirectoryEntryRepository;
    private final SupplierRepository supplierRepository;
    private final UserRepository userRepository;
    private final RbacAuthorizationService rbacAuthorizationService;

    @Override
    @Transactional(readOnly = true)
    public NotificationDirectoryWorkspaceResponse getWorkspace(Authentication authentication, String supplierCode) {
        User currentUser = getCurrentUser(authentication);
        ensureWorkspaceAccess(currentUser, authentication);
        boolean canManageAllSuppliers = canManageAllSuppliers(currentUser);
        SupplierEntity activeSupplier = resolveManagedSupplier(currentUser, supplierCode, canManageAllSuppliers);

        List<NotificationSupplierScopeResponse> suppliers = canManageAllSuppliers
                ? supplierRepository.findAll().stream()
                .sorted(Comparator.comparing(SupplierEntity::getName, String.CASE_INSENSITIVE_ORDER))
                .map(this::toSupplierResponse)
                .toList()
                : List.of(toSupplierResponse(activeSupplier));

        return NotificationDirectoryWorkspaceResponse.builder()
                .canManageAllSuppliers(canManageAllSuppliers)
                .activeSupplierCode(activeSupplier.getCode())
                .activeSupplierName(activeSupplier.getName())
                .suppliers(suppliers)
                .entries(notificationDirectoryEntryRepository.findAllBySupplierCode(activeSupplier.getCode()).stream()
                        .map(this::toEntryResponse)
                        .toList())
                .availableNotificationTypes(List.of(NotificationType.values()))
                .availableChannels(List.of(NotificationChannel.values()))
                .build();
    }

    @Override
    public NotificationDirectoryEntryResponse createEntry(Authentication authentication, NotificationDirectoryEntryRequest request) {
        User currentUser = getCurrentUser(authentication);
        ensureWorkspaceAccess(currentUser, authentication);
        boolean canManageAllSuppliers = canManageAllSuppliers(currentUser);
        SupplierEntity supplier = resolveManagedSupplier(currentUser, request != null ? request.getSupplierCode() : null, canManageAllSuppliers);

        NotificationDirectoryEntry entry = NotificationDirectoryEntry.builder()
                .supplier(supplier)
                .build();
        applyRequest(entry, request);
        return toEntryResponse(notificationDirectoryEntryRepository.save(entry));
    }

    @Override
    public NotificationDirectoryEntryResponse updateEntry(Authentication authentication, Long entryId, NotificationDirectoryEntryRequest request) {
        User currentUser = getCurrentUser(authentication);
        ensureWorkspaceAccess(currentUser, authentication);
        boolean canManageAllSuppliers = canManageAllSuppliers(currentUser);
        NotificationDirectoryEntry entry = getEntry(entryId);
        ensureSupplierAccess(currentUser, entry.getSupplier(), canManageAllSuppliers);

        SupplierEntity supplier = resolveManagedSupplier(currentUser, request != null ? request.getSupplierCode() : null, canManageAllSuppliers);
        entry.setSupplier(supplier);
        applyRequest(entry, request);
        return toEntryResponse(notificationDirectoryEntryRepository.save(entry));
    }

    @Override
    public void deleteEntry(Authentication authentication, Long entryId) {
        User currentUser = getCurrentUser(authentication);
        ensureWorkspaceAccess(currentUser, authentication);
        boolean canManageAllSuppliers = canManageAllSuppliers(currentUser);
        NotificationDirectoryEntry entry = getEntry(entryId);
        ensureSupplierAccess(currentUser, entry.getSupplier(), canManageAllSuppliers);
        notificationDirectoryEntryRepository.delete(entry);
    }

    @Override
    @Transactional(readOnly = true)
    public List<NotificationRecipientResponse> resolveDirectoryRecipients(NotificationType notificationType, String supplierCode, Long depotId) {
        String normalizedSupplier = normalize(supplierCode);
        if (normalizedSupplier == null) {
            return List.of();
        }

        return notificationDirectoryEntryRepository.findAllBySupplierCode(normalizedSupplier).stream()
                .filter(NotificationDirectoryEntry::isEnabled)
                .filter(entry -> entry.isAllNotificationTypes() || entry.getNotificationTypes().contains(notificationType))
                .sorted(Comparator.comparing(NotificationDirectoryEntry::getDisplayName, String.CASE_INSENSITIVE_ORDER))
                .map(entry -> toRoutingResponse(entry, notificationType))
                .toList();
    }

    private void applyRequest(NotificationDirectoryEntry entry, NotificationDirectoryEntryRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("Notification directory entry payload is required");
        }
        if (request.getChannel() == null) {
            throw new IllegalArgumentException("Notification channel is required");
        }
        String displayName = trimToNull(request.getDisplayName());
        String destination = trimToNull(request.getDestination());
        if (displayName == null) {
            throw new IllegalArgumentException("Display name is required");
        }
        if (destination == null) {
            throw new IllegalArgumentException("Destination is required");
        }

        entry.setDisplayName(displayName);
        entry.setChannel(request.getChannel());
        entry.setDestination(destination);
        entry.setEnabled(request.getEnabled() == null || request.getEnabled());
        entry.setAllNotificationTypes(request.getAllNotificationTypes() == null || request.getAllNotificationTypes());
        entry.setNotes(trimToNull(request.getNotes()));

        Set<NotificationType> types = new LinkedHashSet<>();
        if (request.getNotificationTypes() != null) {
            types.addAll(request.getNotificationTypes());
        }
        if (entry.isAllNotificationTypes()) {
            types.clear();
        }
        entry.setNotificationTypes(types);
    }

    private NotificationRecipientResponse toRoutingResponse(NotificationDirectoryEntry entry, NotificationType notificationType) {
        boolean emailEnabled = entry.getChannel() == NotificationChannel.EMAIL;
        boolean smsEnabled = entry.getChannel() == NotificationChannel.SMS;
        boolean whatsappEnabled = entry.getChannel() == NotificationChannel.WHATSAPP;
        return NotificationRecipientResponse.builder()
                .userId(null)
                .firstname(entry.getDisplayName())
                .lastname(entry.getSupplier() != null ? entry.getSupplier().getName() : null)
                .email(emailEnabled ? entry.getDestination() : null)
                .phone(smsEnabled ? entry.getDestination() : null)
                .whatsappNumber(whatsappEnabled ? entry.getDestination() : null)
                .supplierCode(entry.getSupplier() != null ? entry.getSupplier().getCode() : null)
                .supplierName(entry.getSupplier() != null ? entry.getSupplier().getName() : null)
                .depotId(null)
                .userType("Supplier Directory")
                .notificationType(notificationType)
                .emailEnabled(emailEnabled)
                .smsEnabled(smsEnabled)
                .whatsappEnabled(whatsappEnabled)
                .allChannelsEnabled(false)
                .muted(false)
                .build();
    }

    private NotificationDirectoryEntryResponse toEntryResponse(NotificationDirectoryEntry entry) {
        return NotificationDirectoryEntryResponse.builder()
                .id(entry.getId())
                .supplierCode(entry.getSupplier() != null ? entry.getSupplier().getCode() : null)
                .supplierName(entry.getSupplier() != null ? entry.getSupplier().getName() : null)
                .displayName(entry.getDisplayName())
                .channel(entry.getChannel())
                .destination(entry.getDestination())
                .enabled(entry.isEnabled())
                .allNotificationTypes(entry.isAllNotificationTypes())
                .notificationTypes(new ArrayList<>(entry.getNotificationTypes()))
                .notes(entry.getNotes())
                .createdAt(entry.getCreatedAt())
                .updatedAt(entry.getUpdatedAt())
                .build();
    }

    private NotificationSupplierScopeResponse toSupplierResponse(SupplierEntity supplier) {
        return NotificationSupplierScopeResponse.builder()
                .id(supplier.getId())
                .code(supplier.getCode())
                .name(supplier.getName())
                .status(supplier.getStatus())
                .build();
    }

    private User getCurrentUser(Authentication authentication) {
        String email = authentication != null ? authentication.getName() : null;
        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("Authenticated user could not be resolved");
        }
        return userRepository.findDetailedByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Authenticated user not found"));
    }

    private boolean canManageAllSuppliers(User user) {
        String userType = user.getUserType() != null ? user.getUserType().getName() : null;
        return user.getSupplier() == null && (userType == null || !"supplier".equalsIgnoreCase(userType));
    }

    private void ensureWorkspaceAccess(User user, Authentication authentication) {
        if (user.getSupplier() != null) {
            return;
        }
        if (!rbacAuthorizationService.hasPermission(authentication, "users.read")) {
            throw new AccessDeniedException("You are not allowed to manage notification routing.");
        }
    }

    private SupplierEntity resolveManagedSupplier(User currentUser, String requestedSupplierCode, boolean canManageAllSuppliers) {
        if (!canManageAllSuppliers) {
            if (currentUser.getSupplier() == null) {
                throw new IllegalArgumentException("Supplier account is not linked to a supplier");
            }
            return currentUser.getSupplier();
        }

        String normalized = normalize(requestedSupplierCode);
        if (normalized != null) {
            return supplierRepository.findByCodeIgnoreCase(normalized)
                    .orElseThrow(() -> new IllegalArgumentException("Supplier not found: " + requestedSupplierCode));
        }

        return supplierRepository.findAll().stream()
                .sorted(Comparator.comparing(SupplierEntity::getName, String.CASE_INSENSITIVE_ORDER))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("No suppliers are configured"));
    }

    private void ensureSupplierAccess(User currentUser, SupplierEntity supplier, boolean canManageAllSuppliers) {
        if (canManageAllSuppliers) {
            return;
        }
        if (currentUser.getSupplier() == null || supplier == null || supplier.getId() == null) {
            throw new IllegalArgumentException("Supplier access denied");
        }
        if (!supplier.getId().equals(currentUser.getSupplier().getId())) {
            throw new IllegalArgumentException("Supplier access denied");
        }
    }

    private NotificationDirectoryEntry getEntry(Long entryId) {
        return notificationDirectoryEntryRepository.findById(entryId)
                .orElseThrow(() -> new IllegalArgumentException("Notification directory entry not found"));
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed.toLowerCase(Locale.ROOT);
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
