package com.safalifter.transformerservice.payload.request.response;

import com.safalifter.transformerservice.enums.IncidentOutcome;
import lombok.Data;

@Data
public class CloseIncidentRequest {
    private IncidentOutcome outcome;
    private String note;
}
