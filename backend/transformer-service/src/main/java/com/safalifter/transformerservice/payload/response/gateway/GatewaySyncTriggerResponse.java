package com.safalifter.transformerservice.payload.response.gateway;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class GatewaySyncTriggerResponse {
    private Long syncRunId;
    private Instant startedAt;
    private String status;
}
