package com.safalifter.transformerservice.entities;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "simulation_controllers")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SimulationController {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    @Column(name = "device_id")
    private String deviceId;

    @Column(name = "dev_eui", unique = true)
    private String devEui;

    private String type;

    @Column(name = "transformer_id")
    private Long transformerId;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
