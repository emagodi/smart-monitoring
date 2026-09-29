package com.safalifter.transformerservice.payload.request.sim;

import com.safalifter.transformerservice.enums.SimCardStatus;
import lombok.Data;

@Data
public class SimCardListFilterRequest {
    private SimCardStatus status;
    private String operator;
    private String search;
}
