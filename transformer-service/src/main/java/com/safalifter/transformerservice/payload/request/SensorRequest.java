package com.safalifter.transformerservice.payload.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SensorRequest {
    @NotBlank(message = "deviceId is required")
    private String deviceId;
    @NotBlank(message = "devEui is required")
    private String devEui;
    @NotBlank(message = "name is required")
    private String name;
    @NotBlank(message = "type is required")
    private String type;
    @NotNull(message = "transformerId is required")
    private Long transformerId;
}