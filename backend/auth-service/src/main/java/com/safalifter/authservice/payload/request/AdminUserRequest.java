package com.safalifter.authservice.payload.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminUserRequest {
    private String firstname;
    private String lastname;
    private String email;
    private String password;
    private String phone;
    private String whatsappNumber;
    private String employeeNumber;
    private String status;
    private Long userTypeId;
    private List<Long> roleIds;
    private String region;
    private Long regionId;
    private String district;
    private Long districtId;
    private String depot;
    private Long depotId;
    private Long supplierId;
}
