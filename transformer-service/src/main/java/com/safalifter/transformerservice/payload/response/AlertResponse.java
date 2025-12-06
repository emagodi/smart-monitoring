package com.safalifter.transformerservice.payload.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlertResponse {
    private Long id;
    private Long sensorId;
    private String value;
    private Boolean isAlert;
    private String message;
    private Long transformerId;
    private String transformerName;
    private Integer transformerCapacity;
    private Long depotId;
    private String depotName;
    private java.math.BigDecimal lat;
    private java.math.BigDecimal lng;
    private String devEui;
    private String deviceId;
    private String deviceName;
    private String sensorType;
}