package com.safalifter.transformerservice.payload.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CameraRequest {
    private String name;
    private String topic;
    private Long transformerId;
    private String model;
    private String wifiSsid;
    private String macAddress;
    private String ipAddress;
}
