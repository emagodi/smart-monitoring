package com.safalifter.transformerservice.payload.request.response;

import lombok.Data;

@Data
public class DispatchRequest {
    private Long vehicleId;
    private String note;
    /** Send the crew an SMS / WhatsApp / email with their response link (default true). */
    private Boolean notifyCrew;
    /** Allow sending a vehicle that is already on another job. */
    private Boolean force;
}
