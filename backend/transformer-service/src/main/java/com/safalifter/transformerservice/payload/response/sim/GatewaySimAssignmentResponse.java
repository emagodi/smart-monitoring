package com.safalifter.transformerservice.payload.response.sim;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class GatewaySimAssignmentResponse {
    private Long id;
    private Long gatewayId;
    private Long simId;
    private Integer slotNumber;
    private boolean active;
    private String status;
    private Instant assignedAt;
    private Instant unassignedAt;
    private String assignedBy;
    private String unassignedBy;
    private String reason;
    private String notes;
    private String simMsisdn;
    private String simIccid;
}
