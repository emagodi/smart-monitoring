package com.safalifter.transformerservice.payload.response.gateway;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class GatewayStatusHistoryResponse {
    private Long id;
    private String prevStatus;
    private String newStatus;
    private String reason;
    private String source;
    private Instant observedAt;
}
