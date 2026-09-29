package com.safalifter.transformerservice.payload.request.sim;

import com.safalifter.transformerservice.enums.SimCardStatus;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class SimCardCreateRequest {
    private String msisdn;
    private String iccid;
    private String imsi;
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
    private SimCardStatus status;
    private BigDecimal dataPlanGb;
    private BigDecimal allowanceGb;
    private LocalDate activationDate;
    private LocalDate expiryDate;
    private String notes;
}
