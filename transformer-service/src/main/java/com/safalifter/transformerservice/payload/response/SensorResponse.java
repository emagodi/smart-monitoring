package com.safalifter.transformerservice.payload.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SensorResponse {
    private Long id;
    private String deviceId;
    private String devEui;
    private String name;
    private String type;
    private Long transformerId;
    @JsonProperty("sensor_reading")
    @lombok.Builder.Default
    private List<SensorReadingDetailResponse> sensorReadings = java.util.List.of();
}