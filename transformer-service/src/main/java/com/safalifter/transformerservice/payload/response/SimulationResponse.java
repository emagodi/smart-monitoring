package com.safalifter.transformerservice.payload.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class SimulationResponse {
    private String status; // SUCCESS, ERROR
    private String message;
    private Double rawValue;
    private String alertLevel; // SAFE, WARNING, CRITICAL
    private VisionAnalysisResult visionResult;

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    public static class VisionAnalysisResult {
        private String modelType;
        private String detectedClass;
        private Double confidence;
        private List<String> boundingBoxes; // Mock bounding boxes for demo
    }
}
