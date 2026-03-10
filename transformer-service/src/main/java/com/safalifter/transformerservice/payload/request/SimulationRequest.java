package com.safalifter.transformerservice.payload.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class SimulationRequest {
    private Long sensorId;
    private String codedValue; // e.g., "HIGH_TEMP", "NORMAL"
    private Double rawValue;   // e.g., 85.5
    private String sensorType; // e.g., "temperature", "vibration"
}
