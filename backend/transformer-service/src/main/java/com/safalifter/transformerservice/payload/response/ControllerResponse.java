package com.safalifter.transformerservice.payload.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ControllerResponse {
    private Long id;
    private String deviceId;
    private String devEui;
    private String name;
    private String type;
    private Long transformerId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
