package com.safalifter.transformerservice.payload.response.sim;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class SimCardRevealResponse {
    private Long id;
    private String pin;
    private String puk;
}
