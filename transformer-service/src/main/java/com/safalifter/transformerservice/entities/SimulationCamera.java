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
@Table(name = "simulation_cameras")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SimulationCamera {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    @Column(name = "ip_address")
    private String ipAddress;

    private String topic;
    private String model;
    
    @Column(name = "mac_address")
    private String macAddress;
    
    @Column(name = "wifi_ssid")
    private String wifiSsid;

    @Column(name = "transformer_id")
    private Long transformerId;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
