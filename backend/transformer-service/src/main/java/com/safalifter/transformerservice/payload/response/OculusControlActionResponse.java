package com.safalifter.transformerservice.payload.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OculusControlActionResponse {
    private Long transformerId;
    private String transformerName;
    private Long controllerId;
    private String controllerName;
    private String controllerDevEui;
    private String action;
    private String targetState;
    private String commandStatus;
    private String provider;
    private String requestedAt;
    private String requestedBy;
    private String responsePayload;
    private String message;
}
