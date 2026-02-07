package com.safalifter.transformerservice.payload.request;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SensorAnalysisRequest {
    @JsonProperty("sensor_id")
    private Long sensorId;
    
    @JsonProperty("sensor_type")
    private String sensorType;
    
    private Object value;
    
    @JsonProperty("dev_eui")
    private String devEui;

    @JsonProperty("maintenance_mode")
    private boolean maintenanceMode;

    private String timestamp;
}
