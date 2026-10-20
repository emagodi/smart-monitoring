package com.safalifter.transformerservice.payload.request.sim;

import com.safalifter.transformerservice.enums.SimCardStatus;
import lombok.Data;

@Data
public class SimCardListFilterRequest {
    private SimCardStatus status;
    private String operator;
    private String search;
    private com.safalifter.transformerservice.enums.SimNetworkState networkState;
    private com.safalifter.transformerservice.enums.SimCondition condition;
    /** null = any, true = PIN on file, false = no PIN. */
    private Boolean hasPin;
    private Boolean hasPuk;
    /** null = any, true = currently in a gateway, false = spare. */
    private Boolean assigned;
}
