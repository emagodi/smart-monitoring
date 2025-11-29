package com.safalifter.transformerservice.enums;

import lombok.Getter;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.List;

@Getter
public enum Role {
    ADMIN,
    DEPOT_FOREMAN,
    TECHNICIAN,
    MANAGINGDIRECTOR,
    DISTRICTMANAGER,
    FINANCEDIRECTOR,
    TECHNICALDIRECTOR,
    COMMERCIALDIRECTOR,
    BUSINESSMANAGER,
    USER;

    public List<SimpleGrantedAuthority> getAuthorities() {
        return List.of(
                new SimpleGrantedAuthority("ROLE_" + this.name()),
                new SimpleGrantedAuthority("READ_PRIVILEGE"),
                new SimpleGrantedAuthority("WRITE_PRIVILEGE"),
                new SimpleGrantedAuthority("UPDATE_PRIVILEGE"),
                new SimpleGrantedAuthority("DELETE_PRIVILEGE")
        );
    }
}