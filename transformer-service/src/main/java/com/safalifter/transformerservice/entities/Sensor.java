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
@Table(name = "sensors")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Sensor extends BaseEntity {
    @Column(nullable = false)
    private String deviceId;
    @Column(nullable = false)
    private String devEui;
    @Column(nullable = false)
    private String name;
    @Column(nullable = true)
    private String type;
    @Column(name = "transformer_id", nullable = true)
    private Long transformerId;
}