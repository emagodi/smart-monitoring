package com.safalifter.transformerservice.payload.request.sim;

import com.safalifter.transformerservice.enums.SimCardStatus;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class SimCardUpdateRequest {
    private String msisdn;
    private String operator;
    private String apn;
    private SimCardStatus status;
    private BigDecimal dataPlanGb;
    private BigDecimal allowanceGb;
    private LocalDate activationDate;
    private LocalDate expiryDate;
    private String notes;
}
