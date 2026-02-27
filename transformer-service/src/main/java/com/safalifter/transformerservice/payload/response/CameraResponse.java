package com.safalifter.transformerservice.payload.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CameraResponse {
    private Long id;
    private String name;
    private String topic;
    private Long transformerId;
    private String status;
    private String model;
    private String wifiSsid;
    private String macAddress;
    private String ipAddress;
}
