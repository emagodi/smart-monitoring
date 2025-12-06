package com.safalifter.transformerservice.entities;

import com.safalifter.transformerservice.handlers.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "alerts")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Alert extends BaseEntity {
    @Column(name = "sensor_id", nullable = false)
    private Long sensorId;
    @Column
    private String value;
    @Column(nullable = false)
    private boolean isAlert;
    @Column
    private String message;
    @Column(name = "transformer_id")
    private Long transformerId;
    @Column(name = "transformer_name")
    private String transformerName;
    @Column(name = "transformer_capacity")
    private Integer transformerCapacity;
    @Column(name = "depot_id")
    private Long depotId;
    @Column(name = "depot_name")
    private String depotName;
    @Column(name = "lat", precision = 20, scale = 12)
    private java.math.BigDecimal lat;
    @Column(name = "lng", precision = 21, scale = 12)
    private java.math.BigDecimal lng;
    @Column(name = "dev_eui")
    private String devEui;
    @Column(name = "device_id")
    private String deviceId;
    @Column(name = "device_name")
    private String deviceName;
    @Column(name = "sensor_type")
    private String sensorType;
}