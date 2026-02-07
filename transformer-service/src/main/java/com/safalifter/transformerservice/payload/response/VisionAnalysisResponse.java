package com.safalifter.transformerservice.payload.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VisionAnalysisResponse {
    @JsonProperty("risk_score")
    private Double riskScore;
    
    private String decision;
    
    private String details;
}
