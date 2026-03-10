package com.safalifter.transformerservice.payload.response;

import lombok.*;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CameraImageResponse {
    private Long id;
    private String imageUrl;
    private LocalDateTime capturedAt;
    private Long transformerId;
    private String cameraMacAddress;
    private String cameraModel;
    private String cameraWifiSsid;
}
