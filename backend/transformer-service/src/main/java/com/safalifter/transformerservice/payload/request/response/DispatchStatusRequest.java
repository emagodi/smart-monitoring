package com.safalifter.transformerservice.payload.request.response;

import com.safalifter.transformerservice.enums.DispatchStatus;
import lombok.Data;

@Data
public class DispatchStatusRequest {
    /** ACCEPTED, ON_SCENE or CANCELLED. Completion happens through closing the case. */
    private DispatchStatus status;
    private String note;
}
