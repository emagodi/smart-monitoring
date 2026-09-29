package com.safalifter.transformerservice.payload.response.sim;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class SimCardRevealResponse {
    private Long id;
    private String iccid;
    private String imsi;
    private String msisdn;
    private String pin;
    private String puk;
    private String pin2;
    private String puk2;
}
