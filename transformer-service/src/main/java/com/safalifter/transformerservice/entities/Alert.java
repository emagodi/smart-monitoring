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
}