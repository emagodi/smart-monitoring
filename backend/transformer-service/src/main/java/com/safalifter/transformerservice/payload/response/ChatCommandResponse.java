package com.safalifter.transformerservice.payload.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatCommandResponse {
    private String status;
    private String result;
    private String action;
    private Long transformerId;
    private String transformerName;
    private String supplierCode;
    private String operatorName;
    private String providerStatus;
    private String message;
    private String statusMessage;
    private String detail;
}
