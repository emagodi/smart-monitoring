package com.safalifter.transformerservice.entities;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "cameras")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Camera {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true)
    private String name;

    @Column(name = "topic", unique = true)
    private String topic;

    @Column(name = "transformer_id")
    private Long transformerId;

    @Column(name = "status")
    private String status; // ACTIVE, INACTIVE

    @Column(name = "model")
    private String model;

    @Column(name = "wifi_ssid")
    private String wifiSsid;

    @Column(name = "mac_address")
    private String macAddress;

    @Column(name = "ip_address")
    private String ipAddress;

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
    public String getTopic() { return topic; }
    public void setTopic(String topic) { this.topic = topic; }
    public Long getTransformerId() { return transformerId; }
    public void setTransformerId(Long transformerId) { this.transformerId = transformerId; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }
    public String getWifiSsid() { return wifiSsid; }
    public void setWifiSsid(String wifiSsid) { this.wifiSsid = wifiSsid; }
    public String getMacAddress() { return macAddress; }
    public void setMacAddress(String macAddress) { this.macAddress = macAddress; }
    public String getIpAddress() { return ipAddress; }
    public void setIpAddress(String ipAddress) { this.ipAddress = ipAddress; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public static CameraBuilder builder() {
        return new CameraBuilder();
    }

    public static class CameraBuilder {
        private Long id;
        private String name;
        private String topic;
        private Long transformerId;
        private String status;
        private String model;
        private String wifiSsid;
        private String macAddress;
        private String ipAddress;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;

        public CameraBuilder id(Long id) { this.id = id; return this; }
        public CameraBuilder name(String name) { this.name = name; return this; }
        public CameraBuilder topic(String topic) { this.topic = topic; return this; }
        public CameraBuilder transformerId(Long transformerId) { this.transformerId = transformerId; return this; }
        public CameraBuilder status(String status) { this.status = status; return this; }
        public CameraBuilder model(String model) { this.model = model; return this; }
        public CameraBuilder wifiSsid(String wifiSsid) { this.wifiSsid = wifiSsid; return this; }
        public CameraBuilder macAddress(String macAddress) { this.macAddress = macAddress; return this; }
        public CameraBuilder ipAddress(String ipAddress) { this.ipAddress = ipAddress; return this; }
        public CameraBuilder createdAt(LocalDateTime createdAt) { this.createdAt = createdAt; return this; }
        public CameraBuilder updatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; return this; }

        public Camera build() {
            Camera camera = new Camera();
            camera.setId(id);
            camera.setName(name);
            camera.setTopic(topic);
            camera.setTransformerId(transformerId);
            camera.setStatus(status);
            camera.setModel(model);
            camera.setWifiSsid(wifiSsid);
            camera.setMacAddress(macAddress);
            camera.setIpAddress(ipAddress);
            camera.setCreatedAt(createdAt);
            camera.setUpdatedAt(updatedAt);
            return camera;
        }
    }
}
