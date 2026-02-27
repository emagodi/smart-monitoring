package com.safalifter.transformerservice.payload.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlertRequest {
    private Long sensorId;
    private Long cameraId;
    private String value;
    private Boolean isAlert;
    private String message;
    private Long transformerId;
    private String transformerName;
    private Integer transformerCapacity;
    private Long depotId;
    private String depotName;
    private BigDecimal lat;
    private BigDecimal lng;
    private String devEui;
    private String deviceId;
    private String deviceName;
    private String sensorType;
}
