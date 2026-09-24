package com.safalifter.transformerservice.payload.response.sim;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
public class SimCardResponse {
    private Long id;
    private String msisdn;
    private String iccid;
    private String normalizedIccid;
    private String imsi;
    private String normalizedImsi;
    private String operator;
    private String networkName;
    private String apn;
    private String pin;
    private String puk;
    private String pin2;
    private String puk2;
    private String ki;
    private String opc;
    private String cardSerialNumber;
    private String status;
    private Long assignedGatewayId;
    private String assignedGatewayName;
    private Integer slotNumber;
    private Instant assignedAt;
    private Instant unassignedAt;
    private BigDecimal dataPlanGb;
    private BigDecimal allowanceGb;
    private LocalDate activationDate;
    private LocalDate expiryDate;
    private String notes;
    private String createdBy;
    private LocalDateTime createdAt;
    private String updatedBy;
    private LocalDateTime updatedAt;
}
