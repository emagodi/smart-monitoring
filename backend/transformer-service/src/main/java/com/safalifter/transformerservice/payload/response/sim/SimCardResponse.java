package com.safalifter.transformerservice.payload.response.sim;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
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
    private String apn;
    private String pin;
    private String puk;
    private String status;
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
