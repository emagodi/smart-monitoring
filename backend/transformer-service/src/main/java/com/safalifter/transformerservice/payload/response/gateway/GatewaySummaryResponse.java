package com.safalifter.transformerservice.payload.response.gateway;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class GatewaySummaryResponse {
    private long total;
    private long online;
    private long offline;
    private long degraded;
    private long neverSeen;
    private long unknown;
    private long missingLocation;
    private long missingSim;
    private String lastSyncStatus;
    private Instant lastSyncAt;
}
