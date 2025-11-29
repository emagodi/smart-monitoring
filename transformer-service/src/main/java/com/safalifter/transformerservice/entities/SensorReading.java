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
@Table(name = "sensor_readings")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SensorReading extends BaseEntity {
    @Column(name = "sensor_id", nullable = false)
    private Long sensorId;
    @Column(columnDefinition = "LONGTEXT")
    private String rawPayload;
    @Column(columnDefinition = "LONGTEXT")
    private String decoded;
}