package com.safalifter.transformerservice.payload.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

public class CameraResponse {
    private Long id;
    private String name;
    private String topic;
    private Long transformerId;
    private String status;
    private String model;
    private String wifiSsid;
    private String macAddress;
    private String ipAddress;

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

    public static CameraResponseBuilder builder() {
        return new CameraResponseBuilder();
    }

    public static class CameraResponseBuilder {
        private Long id;
        private String name;
        private String topic;
        private Long transformerId;
        private String status;
        private String model;
        private String wifiSsid;
        private String macAddress;
        private String ipAddress;

        public CameraResponseBuilder id(Long id) { this.id = id; return this; }
        public CameraResponseBuilder name(String name) { this.name = name; return this; }
        public CameraResponseBuilder topic(String topic) { this.topic = topic; return this; }
        public CameraResponseBuilder transformerId(Long transformerId) { this.transformerId = transformerId; return this; }
        public CameraResponseBuilder status(String status) { this.status = status; return this; }
        public CameraResponseBuilder model(String model) { this.model = model; return this; }
        public CameraResponseBuilder wifiSsid(String wifiSsid) { this.wifiSsid = wifiSsid; return this; }
        public CameraResponseBuilder macAddress(String macAddress) { this.macAddress = macAddress; return this; }
        public CameraResponseBuilder ipAddress(String ipAddress) { this.ipAddress = ipAddress; return this; }

        public CameraResponse build() {
            CameraResponse response = new CameraResponse();
            response.setId(id);
            response.setName(name);
            response.setTopic(topic);
            response.setTransformerId(transformerId);
            response.setStatus(status);
            response.setModel(model);
            response.setWifiSsid(wifiSsid);
            response.setMacAddress(macAddress);
            response.setIpAddress(ipAddress);
            return response;
        }
    }
}
