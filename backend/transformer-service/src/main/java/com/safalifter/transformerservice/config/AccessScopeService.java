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

    public String getCurrentUserEmail() {
        AuthenticatedUserPrincipal principal = getCurrentPrincipal();
        return principal != null ? principal.getEmail() : null;
    }

    public Long getCurrentDepotId() {
        AuthenticatedUserPrincipal principal = getCurrentPrincipal();
        return principal != null ? principal.getDepotId() : null;
    }

    /**
     * Fine-grained permission check (tick-box permissions from Roles admin, e.g. "response.dispatch").
     * Administrators always pass. If the auth-service did not send a permission list (older
     * auth-service build), internal users fall back to allowed so nothing locks up mid-deploy.
     */
    public boolean hasPermission(String permission) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null) {
            return false;
        }
        boolean permissionsKnown = false;
        for (var authority : authentication.getAuthorities()) {
            String name = authority.getAuthority();
            if ("ROLE_ADMIN".equals(name) || name.equals(permission)) {
                return true;
            }
            if (PERMISSIONS_LOADED.equals(name)) {
                permissionsKnown = true;
            }
        }
        return !permissionsKnown && !isSupplierScoped();
    }

    /** Marker authority added when the access profile carried an explicit permission list. */
    public static final String PERMISSIONS_LOADED = "PERMISSIONS_LOADED";

    /** Cache key for data that depends only on what the caller may see (partner and depot scope). */
    public String scopeKey() {
        String supplier = getCurrentSupplierCode();
        Long depot = getCurrentDepotId();
        return (supplier == null ? "*" : supplier.toLowerCase()) + "|" + (depot == null ? "*" : depot);
    }

    public boolean isDepotScoped() {
        return getCurrentDepotId() != null;
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
