package com.safalifter.authservice.service;

import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

@Service("rbacAuthorizationService")
public class RbacAuthorizationService {

    public boolean hasPermission(Authentication authentication, String permission) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return false;
        }
        return authentication.getAuthorities().stream()
                .anyMatch(authority -> permission.equalsIgnoreCase(authority.getAuthority()) ||
                        "READ_PRIVILEGE".equals(authority.getAuthority()) ||
                        "ROLE_ADMIN".equalsIgnoreCase(authority.getAuthority()));
    }
}
