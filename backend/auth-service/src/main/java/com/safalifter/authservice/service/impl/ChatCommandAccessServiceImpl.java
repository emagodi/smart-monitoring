package com.safalifter.authservice.service.impl;

import com.safalifter.authservice.entities.RoleEntity;
import com.safalifter.authservice.entities.User;
import com.safalifter.authservice.enums.Role;
import com.safalifter.authservice.exception.UserNotFoundException;
import com.safalifter.authservice.payload.response.ChatCommandUserResponse;
import com.safalifter.authservice.repository.UserRepository;
import com.safalifter.authservice.service.ChatCommandAccessService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ChatCommandAccessServiceImpl implements ChatCommandAccessService {

    private static final List<String> TEMP_ALLOWED_ROLES = List.of(
            "ADMIN",
            "ADMINISTRATOR",
            "DEPOT_FOREMAN",
            "TECHNICIAN",
            "MANAGINGDIRECTOR",
            "DISTRICTMANAGER",
            "FINANCEDIRECTOR",
            "TECHNICALDIRECTOR",
            "COMMERCIALDIRECTOR",
            "BUSINESSMANAGER",
            "USER"
    );

    private final UserRepository userRepository;

    @Override
    public ChatCommandUserResponse resolveUserByContact(String contact) {
        String normalizedContact = normalizeContact(contact);
        if (normalizedContact == null) {
            throw new UserNotFoundException("Chat command contact could not be resolved");
        }

        User user = userRepository.findAllWithIam().stream()
                .filter(candidate -> matchesContact(candidate, contact, normalizedContact))
                .sorted(Comparator.comparing((User candidate) -> normalizeContact(candidate.getWhatsappNumber()) != null
                        && normalizeContact(candidate.getWhatsappNumber()).equals(normalizedContact) ? 0 : 1))
                .findFirst()
                .orElseThrow(() -> new UserNotFoundException("No user found for contact: " + contact));

        return ChatCommandUserResponse.builder()
                .userId(user.getId())
                .firstname(user.getFirstname())
                .lastname(user.getLastname())
                .email(user.getEmail())
                .phone(user.getPhone())
                .whatsappNumber(user.getWhatsappNumber())
                .employeeNumber(user.getEmployeeNumber())
                .status(user.getStatus())
                .userType(user.getUserType() != null ? user.getUserType().getName() : null)
                .supplierCode(user.getSupplier() != null ? user.getSupplier().getCode() : null)
                .supplierName(user.getSupplier() != null ? user.getSupplier().getName() : null)
                .roles(resolveRoles(user))
                .allowedToControl(isAllowedToControl(user))
                .build();
    }

    private boolean matchesContact(User user, String rawContact, String normalizedContact) {
        if (rawContact != null) {
            String trimmed = rawContact.trim();
            if (!trimmed.isBlank()) {
                if (trimmed.equalsIgnoreCase(user.getEmail())) {
                    return true;
                }
                if (user.getEmployeeNumber() != null && trimmed.equalsIgnoreCase(user.getEmployeeNumber())) {
                    return true;
                }
            }
        }
        return normalizedContact.equals(normalizeContact(user.getWhatsappNumber()))
                || normalizedContact.equals(normalizeContact(user.getPhone()));
    }

    private boolean isAllowedToControl(User user) {
        if (!user.isEnabled()) {
            return false;
        }
        if (user.getUserType() != null && user.getUserType().getName() != null
                && "supplier".equalsIgnoreCase(user.getUserType().getName())) {
            return true;
        }
        if (user.getRole() == Role.ADMIN || user.getRole() == Role.USER) {
            return true;
        }
        return resolveRoles(user).stream().map(this::normalizeRoleName).anyMatch(TEMP_ALLOWED_ROLES::contains);
    }

    private List<String> resolveRoles(User user) {
        if (user.getRoles() != null && !user.getRoles().isEmpty()) {
            return user.getRoles().stream()
                    .map(RoleEntity::getName)
                    .filter(name -> name != null && !name.isBlank())
                    .sorted(String::compareToIgnoreCase)
                    .toList();
        }
        if (user.getRole() != null) {
            return List.of(user.getRole().name());
        }
        return List.of();
    }

    private String normalizeContact(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.isBlank()) {
            return null;
        }
        String normalized = trimmed.replaceAll("[^0-9]", "");
        return normalized.isBlank() ? trimmed.toLowerCase(Locale.ROOT) : normalized;
    }

    private String normalizeRoleName(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT).replace(' ', '_');
    }
}
