package com.safalifter.transformerservice.payload.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SensorReadingDetailResponse {
    private Long id;
    private Long sensorId;
    private String createdAt;
    private String updatedAt;
    private Map<String, Object> attributes;
}
