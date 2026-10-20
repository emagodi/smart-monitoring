package com.safalifter.transformerservice.payload.request.sim;

import lombok.Data;

@Data
public class SimAssignRequest {
    private Long simId;
    private Integer slotNumber;
    private String reason;
    private String notes;
    /** Optional: PIN / PUK printed on the SIM plastic, captured at install time (stored encrypted). */
    private String pin;
    private String puk;
}
