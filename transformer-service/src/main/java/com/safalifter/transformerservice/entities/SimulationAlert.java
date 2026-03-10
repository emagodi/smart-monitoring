package com.safalifter.transformerservice.entities;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "simulation_alerts")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SimulationAlert {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "image_url")
    private String imageUrl;

    private Boolean di1;
    private Boolean di2;

    @Column(name = "depot_id")
    private Long depotId;

    @Column(name = "transformer_id")
    private Long transformerId;

    @Column(name = "transformer_name")
    private String transformerName;

    private String message;
    
    @Column(name = "detected_class")
    private String detectedClass;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
