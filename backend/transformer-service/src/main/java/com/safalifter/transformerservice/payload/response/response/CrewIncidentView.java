package com.safalifter.transformerservice.payload.response.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** What a crew sees on the public response link: only what they need, nothing more. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CrewIncidentView {
    private String transformerName;
    private String transformerType;
    private String event;
    private String depotName;
    private BigDecimal lat;
    private BigDecimal lng;
    private LocalDateTime detectedAt;
    private Integer occurrenceCount;
    private String caseStatus;
    private String outcome;
    private String vehicleRegistration;
    private String vehicleCallSign;
    private String crewLeadName;
    private String dispatchStatus;
    private String dispatchNote;
    private LocalDateTime dispatchedAt;
    private LocalDateTime acceptedAt;
    private LocalDateTime onSceneAt;
    private LocalDateTime completedAt;
    private boolean canAccept;
    private boolean canArrive;
    private boolean canClose;
}
