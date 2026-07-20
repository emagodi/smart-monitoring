package com.safalifter.transformerservice.payload.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlertResponse {
    private Long id;
    private Long sensorId;
    private Long cameraId;
    private String value;
    private boolean isAlert;
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
    private String supplierCode;
    private String supplierName;
    private String imageUrl;
}
