package com.safalifter.transformerservice.payload.request;

import com.safalifter.transformerservice.enums.AlertCaseStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlertCaseUpdateRequest {
    private AlertCaseStatus status;
    private String assignedToEmail;
    private String assignedToName;
    private String note;
}
