package com.safalifter.transformerservice.config;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatCommandUserProfile {
    private Long userId;
    private String firstname;
    private String lastname;
    private String email;
    private String phone;
    private String whatsappNumber;
    private String employeeNumber;
    private String status;
    private String userType;
    private String supplierCode;
    private String supplierName;
    private List<String> roles;
    private boolean allowedToControl;
}
