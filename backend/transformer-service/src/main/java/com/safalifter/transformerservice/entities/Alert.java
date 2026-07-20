package com.safalifter.transformerservice.entities;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "alerts")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Alert {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "sensor_id")
    private Long sensorId;

    @Column(name = "camera_id")
    private Long cameraId;

    private String value;

    @Column(name = "is_alert")
    private boolean isAlert;

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

    private BigDecimal lat;
    private BigDecimal lng;

    @Column(name = "dev_eui")
    private String devEui;

    @Column(name = "device_id")
    private String deviceId;

    @Column(name = "device_name")
    private String deviceName;

    @Column(name = "sensor_type")
    private String sensorType;

    @Column(name = "supplier_code")
    private String supplierCode;

    @Column(name = "supplier_name")
    private String supplierName;

    @Column(name = "image_url")
    private String imageUrl;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
