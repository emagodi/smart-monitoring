package com.safalifter.authservice.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static com.safalifter.authservice.enums.Privilege.*;

@RequiredArgsConstructor
public enum Role {
    ADMIN(
            Set.of(READ_PRIVILEGE,WRITE_PRIVILEGE,UPDATE_PRIVILEGE,DELETE_PRIVILEGE)
    ),
    PALEGAL(
            Set.of(READ_PRIVILEGE,WRITE_PRIVILEGE,UPDATE_PRIVILEGE,DELETE_PRIVILEGE)
    ),
    COMPANYSECRETARY(
            Set.of(READ_PRIVILEGE,WRITE_PRIVILEGE,UPDATE_PRIVILEGE,DELETE_PRIVILEGE)
    ),
    MANAGINGDIRECTOR(
            Set.of(READ_PRIVILEGE,WRITE_PRIVILEGE,UPDATE_PRIVILEGE,DELETE_PRIVILEGE)
    ),
    PROCUREMENTMANAGER(
            Set.of(READ_PRIVILEGE,WRITE_PRIVILEGE,UPDATE_PRIVILEGE,DELETE_PRIVILEGE)
    ),
    FINANCEDIRECTOR(
            Set.of(READ_PRIVILEGE,WRITE_PRIVILEGE,UPDATE_PRIVILEGE,DELETE_PRIVILEGE)
    ),
    TECHNICALDIRECTOR(
            Set.of(READ_PRIVILEGE,WRITE_PRIVILEGE,UPDATE_PRIVILEGE,DELETE_PRIVILEGE)
    ),
    COMMERCIALDIRECTOR(
            Set.of(READ_PRIVILEGE,WRITE_PRIVILEGE,UPDATE_PRIVILEGE,DELETE_PRIVILEGE)
    ),
    BUSINESSMANAGER(
            Set.of(READ_PRIVILEGE,WRITE_PRIVILEGE,UPDATE_PRIVILEGE)
    ),
    HOD(
            Set.of(READ_PRIVILEGE,WRITE_PRIVILEGE,UPDATE_PRIVILEGE,DELETE_PRIVILEGE)
    ),
    USER(
            Set.of(READ_PRIVILEGE,WRITE_PRIVILEGE,UPDATE_PRIVILEGE,DELETE_PRIVILEGE)
    );

    @Getter
    private final Set<Privilege> privileges;

    public List<SimpleGrantedAuthority> getAuthorities(){
        List<SimpleGrantedAuthority> authorities = getPrivileges()
                .stream()
                .map(privilege -> new SimpleGrantedAuthority(privilege.name()))
                .collect(Collectors.toList());
        authorities.add(new SimpleGrantedAuthority("ROLE_"+this.name()));
        return authorities;
    }


}
