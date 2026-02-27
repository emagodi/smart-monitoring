package com.safalifter.transformerservice.payload.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

public class CameraRequest {
    private String name;
    private String topic;
    private Long transformerId;
    private String model;
    private String wifiSsid;
    private String macAddress;
    private String ipAddress;

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getTopic() { return topic; }
    public void setTopic(String topic) { this.topic = topic; }
    public Long getTransformerId() { return transformerId; }
    public void setTransformerId(Long transformerId) { this.transformerId = transformerId; }
    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }
    public String getWifiSsid() { return wifiSsid; }
    public void setWifiSsid(String wifiSsid) { this.wifiSsid = wifiSsid; }
    public String getMacAddress() { return macAddress; }
    public void setMacAddress(String macAddress) { this.macAddress = macAddress; }
    public String getIpAddress() { return ipAddress; }
    public void setIpAddress(String ipAddress) { this.ipAddress = ipAddress; }

    public static CameraRequestBuilder builder() {
        return new CameraRequestBuilder();
    }

    public static class CameraRequestBuilder {
        private String name;
        private String topic;
        private Long transformerId;
        private String model;
        private String wifiSsid;
        private String macAddress;
        private String ipAddress;

        public CameraRequestBuilder name(String name) { this.name = name; return this; }
        public CameraRequestBuilder topic(String topic) { this.topic = topic; return this; }
        public CameraRequestBuilder transformerId(Long transformerId) { this.transformerId = transformerId; return this; }
        public CameraRequestBuilder model(String model) { this.model = model; return this; }
        public CameraRequestBuilder wifiSsid(String wifiSsid) { this.wifiSsid = wifiSsid; return this; }
        public CameraRequestBuilder macAddress(String macAddress) { this.macAddress = macAddress; return this; }
        public CameraRequestBuilder ipAddress(String ipAddress) { this.ipAddress = ipAddress; return this; }

        public CameraRequest build() {
            CameraRequest request = new CameraRequest();
            request.setName(name);
            request.setTopic(topic);
            request.setTransformerId(transformerId);
            request.setModel(model);
            request.setWifiSsid(wifiSsid);
            request.setMacAddress(macAddress);
            request.setIpAddress(ipAddress);
            return request;
        }
    }
}
