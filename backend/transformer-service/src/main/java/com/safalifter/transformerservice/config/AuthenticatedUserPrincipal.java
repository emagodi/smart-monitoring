package com.safalifter.transformerservice.config;

import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;

@Getter
public class AuthenticatedUserPrincipal implements UserDetails {
    private final String email;
    private final String userType;
    private final Long supplierId;
    private final String supplierCode;
    private final String supplierName;
    private final Long depotId;
    private final Collection<? extends GrantedAuthority> authorities;

    public AuthenticatedUserPrincipal(
            String email,
            String userType,
            Long supplierId,
            String supplierCode,
            String supplierName,
            Long depotId,
            Collection<? extends GrantedAuthority> authorities
    ) {
        this.email = email;
        this.userType = userType;
        this.supplierId = supplierId;
        this.supplierCode = supplierCode;
        this.supplierName = supplierName;
        this.depotId = depotId;
        this.authorities = authorities;
    }

    @Override
    public String getPassword() {
        return "";
    }

    @Override
    public String getUsername() {
        return email;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return true;
    }
}
