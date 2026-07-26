package com.safalifter.transformerservice.payload.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DigitalOperatorAccessResponse {
    private Long userId;
    private String operatorName;
    private String email;
    private String phone;
    private String whatsappNumber;
    private String status;
    private String userType;
    private String supplierCode;
    private String supplierName;
    private List<String> roles;
    private boolean allowedToControl;
    private String message;
}
