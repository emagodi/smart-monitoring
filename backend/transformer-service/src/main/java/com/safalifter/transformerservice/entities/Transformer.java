package com.safalifter.transformerservice.entities;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "transformers")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Transformer {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    /** Utility transformer number (was "capacity"; column renamed by SchemaUpgrader). */
    @Column(name = "transformer_number", length = 64)
    private String transformerNumber;

    @Column(name = "is_active")
    private boolean isActive;

    @Column(name = "depot_id")
    private Long depotId;

    @Column(name = "supplier_code")
    private String supplierCode;

    @Column(name = "supplier_name")
    private String supplierName;

    @Enumerated(EnumType.STRING)
    private TransformerType type;

    @Column(name = "lat", precision = 12, scale = 8)
    private BigDecimal lat;

    @Column(name = "lng", precision = 12, scale = 8)
    private BigDecimal lng;

    @Column(name = "last_telemetry_at")
    private LocalDateTime lastTelemetryAt;

    @Column(name = "last_command_at")
    private LocalDateTime lastCommandAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getTransformerNumber() { return transformerNumber; }
    public void setTransformerNumber(String transformerNumber) { this.transformerNumber = transformerNumber; }
    public boolean isActive() { return isActive; }
    public void setActive(boolean isActive) { this.isActive = isActive; }
    public Long getDepotId() { return depotId; }
    public void setDepotId(Long depotId) { this.depotId = depotId; }
    public BigDecimal getLat() { return lat; }
    public void setLat(BigDecimal lat) { this.lat = lat; }
    public BigDecimal getLng() { return lng; }
    public void setLng(BigDecimal lng) { this.lng = lng; }
    public LocalDateTime getLastTelemetryAt() { return lastTelemetryAt; }
    public void setLastTelemetryAt(LocalDateTime t) { this.lastTelemetryAt = t; }
    public LocalDateTime getLastCommandAt() { return lastCommandAt; }
    public void setLastCommandAt(LocalDateTime t) { this.lastCommandAt = t; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
