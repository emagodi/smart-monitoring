package com.safalifter.transformerservice.entities;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "controllers")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Controller {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "device_id")
    private String deviceId;

    @Column(name = "dev_eui")
    private String devEui;

    private String name;

    private String type;

    @Column(name = "supplier_code")
    private String supplierCode;

    @Column(name = "supplier_name")
    private String supplierName;

    @Column(name = "transformer_id")
    private Long transformerId;

    @Column(name = "last_reading_at")
    private LocalDateTime lastReadingAt;

    @Column(name = "last_reading_di1")
    private Boolean lastReadingDi1;

    @Column(name = "last_reading_di2")
    private Boolean lastReadingDi2;

    @Column(name = "last_reading_battery")
    private Integer lastReadingBattery;

    @Column(name = "last_reading_rssi")
    private Integer lastReadingRssi;

    @Column(name = "last_reading_snr")
    private Integer lastReadingSnr;

    @Lob
    @Column(name = "last_reading_decoded_payload", columnDefinition = "TEXT")
    private String lastReadingDecodedPayload;

    @Column(name = "last_command_at")
    private LocalDateTime lastCommandAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "last_command_action")
    private com.safalifter.transformerservice.enums.ControllerCommandAction lastCommandAction;

    @Enumerated(EnumType.STRING)
    @Column(name = "last_command_status")
    private com.safalifter.transformerservice.enums.ControllerCommandStatus lastCommandStatus;

    @Column(name = "last_command_requested_by")
    private String lastCommandRequestedBy;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public LocalDateTime getLastReadingAt() { return lastReadingAt; }
    public void setLastReadingAt(LocalDateTime lastReadingAt) { this.lastReadingAt = lastReadingAt; }
    public Boolean getLastReadingDi1() { return lastReadingDi1; }
    public void setLastReadingDi1(Boolean lastReadingDi1) { this.lastReadingDi1 = lastReadingDi1; }
    public Boolean getLastReadingDi2() { return lastReadingDi2; }
    public void setLastReadingDi2(Boolean lastReadingDi2) { this.lastReadingDi2 = lastReadingDi2; }
    public Integer getLastReadingBattery() { return lastReadingBattery; }
    public void setLastReadingBattery(Integer lastReadingBattery) { this.lastReadingBattery = lastReadingBattery; }
    public Integer getLastReadingRssi() { return lastReadingRssi; }
    public void setLastReadingRssi(Integer lastReadingRssi) { this.lastReadingRssi = lastReadingRssi; }
    public Integer getLastReadingSnr() { return lastReadingSnr; }
    public void setLastReadingSnr(Integer lastReadingSnr) { this.lastReadingSnr = lastReadingSnr; }
    public String getLastReadingDecodedPayload() { return lastReadingDecodedPayload; }
    public void setLastReadingDecodedPayload(String p) { this.lastReadingDecodedPayload = p; }
    public LocalDateTime getLastCommandAt() { return lastCommandAt; }
    public void setLastCommandAt(LocalDateTime t) { this.lastCommandAt = t; }
    public com.safalifter.transformerservice.enums.ControllerCommandAction getLastCommandAction() { return lastCommandAction; }
    public void setLastCommandAction(com.safalifter.transformerservice.enums.ControllerCommandAction a) { this.lastCommandAction = a; }
    public com.safalifter.transformerservice.enums.ControllerCommandStatus getLastCommandStatus() { return lastCommandStatus; }
    public void setLastCommandStatus(com.safalifter.transformerservice.enums.ControllerCommandStatus s) { this.lastCommandStatus = s; }
    public String getLastCommandRequestedBy() { return lastCommandRequestedBy; }
    public void setLastCommandRequestedBy(String u) { this.lastCommandRequestedBy = u; }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getDeviceId() { return deviceId; }
    public void setDeviceId(String deviceId) { this.deviceId = deviceId; }
    public String getDevEui() { return devEui; }
    public void setDevEui(String devEui) { this.devEui = devEui; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public Long getTransformerId() { return transformerId; }
    public void setTransformerId(Long transformerId) { this.transformerId = transformerId; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
