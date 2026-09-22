package com.safalifter.transformerservice.payload.request.sim;

import lombok.Data;

@Data
public class SimAssignRequest {
    private Long simId;
    private Integer slotNumber;
    private String reason;
    private String notes;
}
