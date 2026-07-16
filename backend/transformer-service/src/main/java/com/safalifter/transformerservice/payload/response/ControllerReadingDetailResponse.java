package com.safalifter.transformerservice.payload.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ControllerReadingDetailResponse {
    private Long id;
    private Long controllerId;
    private String createdAt;
    private String updatedAt;
    private String rawPayload;
    private String decodedPayload;
    private Map<String, Object> attributes;
}
