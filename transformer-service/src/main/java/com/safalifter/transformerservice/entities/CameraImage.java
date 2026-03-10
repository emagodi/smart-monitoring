package com.safalifter.transformerservice.entities;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "camera_images")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CameraImage {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "camera_id", nullable = false)
    private Camera camera;

    @Column(name = "image_path", nullable = false)
    private String imagePath;

    @CreationTimestamp
    @Column(name = "captured_at", updatable = false)
    private LocalDateTime capturedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Camera getCamera() { return camera; }
    public void setCamera(Camera camera) { this.camera = camera; }
    public String getImagePath() { return imagePath; }
    public void setImagePath(String imagePath) { this.imagePath = imagePath; }
    public LocalDateTime getCapturedAt() { return capturedAt; }
    public void setCapturedAt(LocalDateTime capturedAt) { this.capturedAt = capturedAt; }
}
