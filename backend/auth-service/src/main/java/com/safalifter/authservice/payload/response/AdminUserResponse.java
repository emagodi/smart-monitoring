package com.safalifter.authservice.payload.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminUserResponse {
    private Long id;
    private String firstname;
    private String lastname;
    private String email;
    private String phone;
    private String whatsappNumber;
    private String employeeNumber;
    private String status;
    private String userType;
    private Long userTypeId;
    private List<String> roles;
    private List<Long> roleIds;
    private String region;
    private String district;
    private String depot;
    private Long supplierId;
    private String supplierCode;
    private String supplierName;
    private LocalDateTime lastLoginAt;
    private LocalDateTime createdDate;
}
