package com.safalifter.transformerservice.payload.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OculusTransformerControlResponse {
    private Long transformerId;
    private String transformerName;
    private String transformerType;
    private Long depotId;
    private Integer controllerCount;
    private Long controllerId;
    private String controllerName;
    private String controllerDevEui;
    private String controllerType;
    private Boolean controlAvailable;
    private String availabilityReason;
    private String armState;
    private Boolean armed;
    private String effectiveArmState;
    private Boolean effectiveArmed;
    private String effectiveStateSource;
    private String confirmationStatus;
    private String controllerStatus;
    private Long minutesSinceLastTelemetry;
    private Boolean motionDetected;
    private String motionStatusLabel;
    private Boolean secondaryAlertDetected;
    private String secondaryAlertLabel;
    private String secondaryAlertStatusLabel;
    private String activeAlertSummary;
    private String lastTelemetryAt;
    private String lastCommandAction;
    private String lastCommandStatus;
    private String lastCommandAt;
    private String lastCommandRequestedBy;
    private String supplierCode;
    private String supplierName;
}
