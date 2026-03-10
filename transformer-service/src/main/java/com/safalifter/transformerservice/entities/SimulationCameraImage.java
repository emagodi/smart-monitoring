package com.safalifter.transformerservice.entities;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "simulation_camera_images")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SimulationCameraImage {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "simulation_camera_id", nullable = false)
    private SimulationCamera simulationCamera;

    @Column(name = "image_path", nullable = false)
    private String imagePath;

    @CreationTimestamp
    @Column(name = "captured_at", updatable = false)
    private LocalDateTime capturedAt;
}
