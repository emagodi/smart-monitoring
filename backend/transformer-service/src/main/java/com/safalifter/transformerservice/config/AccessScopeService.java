package com.safalifter.transformerservice.config;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
public class AccessScopeService {

    public boolean isSupplierScoped() {
        return getCurrentSupplierCode() != null;
    }

    public String getCurrentSupplierCode() {
        AuthenticatedUserPrincipal principal = getCurrentPrincipal();
        if (principal == null || principal.getSupplierCode() == null || principal.getSupplierCode().isBlank()) {
            return null;
        }
        return principal.getSupplierCode();
    }

    public String getCurrentSupplierName() {
        AuthenticatedUserPrincipal principal = getCurrentPrincipal();
        if (principal == null || principal.getSupplierName() == null || principal.getSupplierName().isBlank()) {
            return null;
        }
        return principal.getSupplierName();
    }

    public String getCurrentUserType() {
        AuthenticatedUserPrincipal principal = getCurrentPrincipal();
        return principal != null ? principal.getUserType() : null;
    }

    private AuthenticatedUserPrincipal getCurrentPrincipal() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null) {
            return null;
        }
        Object principal = authentication.getPrincipal();
        if (principal instanceof AuthenticatedUserPrincipal authenticatedUserPrincipal) {
            return authenticatedUserPrincipal;
        }
        return null;
    }
}
