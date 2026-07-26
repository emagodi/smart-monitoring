package com.safalifter.authservice.payload.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthenticationResponse {
    private  Long id;

    private String firstname;

    private String lastname;

    private String password;


    private String email;

    private String phone;

    @JsonProperty("whatsapp_number")
    private String whatsappNumber;

    private String employeeNumber;

    private String status;

    private String userType;

    private String region;

    private String district;

    private String depot;

    @JsonProperty("region_id")
    private Long regionId;

    @JsonProperty("district_id")
    private Long districtId;

    @JsonProperty("depot_id")
    private Long depotId;

    @JsonProperty("supplier_id")
    private Long supplierId;

    @JsonProperty("supplier_code")
    private String supplierCode;

    @JsonProperty("supplier_name")
    private String supplierName;

    private List<String> roles;

    private List<String> permissions;

    private boolean temporaryPassword;

    @JsonProperty("access_token")
    private String accessToken;
    @JsonProperty("refresh_token")
    private String refreshToken;
    @JsonProperty("token_type")
    private String tokenType;

    private String message;

    private boolean createdByAdmin;

}
