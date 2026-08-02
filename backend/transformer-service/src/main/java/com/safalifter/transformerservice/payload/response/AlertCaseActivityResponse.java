package com.safalifter.transformerservice.payload.response;

import com.safalifter.transformerservice.enums.AlertCaseActivityType;
import com.safalifter.transformerservice.enums.AlertCaseStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlertCaseActivityResponse {
    private Long id;
    private AlertCaseActivityType activityType;
    private AlertCaseStatus statusBefore;
    private AlertCaseStatus statusAfter;
    private String actorEmail;
    private String actorName;
    private String note;
    private LocalDateTime createdAt;
}
