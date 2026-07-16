package com.safalifter.transformerservice.entities;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "controller_readings")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ControllerReading {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "controller_id")
    private Long controllerId;

    @Lob
    @Column(name = "raw_payload", columnDefinition = "TEXT")
    private String rawPayload;

    @Column(name = "di1")
    private Boolean di1; // Motion

    @Column(name = "di2")
    private Boolean di2; // Contact

    @Column(name = "battery")
    private Integer battery;

    @Column(name = "rssi")
    private Integer rssi;

    @Column(name = "snr")
    private Integer snr;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
