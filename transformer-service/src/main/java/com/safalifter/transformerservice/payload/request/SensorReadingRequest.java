package com.safalifter.transformerservice.payload.request;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SensorReadingRequest {
    @NotNull(message = "sensorId is required")
    private Long sensorId;
    private String rawPayload;
    private String decoded;
}