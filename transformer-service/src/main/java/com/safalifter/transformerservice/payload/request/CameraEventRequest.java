package com.safalifter.transformerservice.payload.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

public class CameraEventRequest {
    private String topic;
    private String aiClass;
    private Double confidence;
    private String timestamp;
    private String imagePath;

    public String getTopic() { return topic; }
    public void setTopic(String topic) { this.topic = topic; }
    public String getAiClass() { return aiClass; }
    public void setAiClass(String aiClass) { this.aiClass = aiClass; }
    public Double getConfidence() { return confidence; }
    public void setConfidence(Double confidence) { this.confidence = confidence; }
    public String getTimestamp() { return timestamp; }
    public void setTimestamp(String timestamp) { this.timestamp = timestamp; }
    public String getImagePath() { return imagePath; }
    public void setImagePath(String imagePath) { this.imagePath = imagePath; }

    public static CameraEventRequestBuilder builder() {
        return new CameraEventRequestBuilder();
    }

    public static class CameraEventRequestBuilder {
        private String topic;
        private String aiClass;
        private Double confidence;
        private String timestamp;
        private String imagePath;

        public CameraEventRequestBuilder topic(String topic) { this.topic = topic; return this; }
        public CameraEventRequestBuilder aiClass(String aiClass) { this.aiClass = aiClass; return this; }
        public CameraEventRequestBuilder confidence(Double confidence) { this.confidence = confidence; return this; }
        public CameraEventRequestBuilder timestamp(String timestamp) { this.timestamp = timestamp; return this; }
        public CameraEventRequestBuilder imagePath(String imagePath) { this.imagePath = imagePath; return this; }

        public CameraEventRequest build() {
            CameraEventRequest request = new CameraEventRequest();
            request.setTopic(topic);
            request.setAiClass(aiClass);
            request.setConfidence(confidence);
            request.setTimestamp(timestamp);
            request.setImagePath(imagePath);
            return request;
        }
    }
}
