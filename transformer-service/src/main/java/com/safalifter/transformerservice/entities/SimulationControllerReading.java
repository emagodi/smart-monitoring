package com.safalifter.transformerservice.entities;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "simulation_controller_readings")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SimulationControllerReading {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "simulation_controller_id")
    private Long simulationControllerId;

    @Lob
    @Column(name = "raw_payload", columnDefinition = "TEXT")
    private String rawPayload;

    @Column(name = "di1")
    private Boolean di1;

    @Column(name = "di2")
    private Boolean di2;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
