package com.safalifter.transformerservice.payload.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class SensorResponse {
    private Long id;
    private String deviceId;
    private String devEui;
    private String name;
    private String type;
    private Long transformerId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<SensorReadingDetailResponse> sensorReadings;
}
