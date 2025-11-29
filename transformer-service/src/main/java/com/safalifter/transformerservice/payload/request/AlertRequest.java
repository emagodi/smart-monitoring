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
public class AlertRequest {
    @NotNull(message = "sensorId is required")
    private Long sensorId;
    private String value;
    @NotNull(message = "isAlert is required")
    private Boolean isAlert;
    private String message;
}