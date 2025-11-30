package com.safalifter.authservice.entities;

import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import com.safalifter.authservice.enums.Role;


import java.time.LocalDateTime;
import java.util.Collection;

@Builder
@NoArgsConstructor
@AllArgsConstructor
@Data
@Entity
@Table(name = "_user")
public class User implements UserDetails { // make our app User a spring security User
/*
    we have two options : implements the UserDetails interface or create a user class that extends User spring class which also
    implements UserDetails
 */
    @Id
    @GeneratedValue
    private Long id;

    private String firstname;

    private String lastname;

    @Column(unique = true)
    private String email;

    @JsonIgnore
    private String password;

    private String phone;

    @Enumerated(EnumType.STRING)
    private Role role;

    private String region;

    private String district;

    private String depot;

    @OneToOne(mappedBy = "user")
    private ForgotPassword forgotPassword;

    private boolean temporaryPassword;

    private String otp;
    private LocalDateTime otpExpiry;


    // we should return a list of roles
    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return role.getAuthorities();
    }

    @Override
    public String getPassword() {
        return password;
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
