package com.safalifter.notificationservice.payload.chat;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatCommandBridgeResponse {
    private String status;
    private String action;
    private Long transformerId;
    private String transformerName;
    private String supplierCode;
    private String operatorName;
    private String providerStatus;
    private String message;
}
