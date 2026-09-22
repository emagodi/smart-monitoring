package com.safalifter.transformerservice.payload.response.gateway;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;

@Data
@Builder
public class GatewayMapPointResponse {
    private Long id;
    private String name;
    private BigDecimal latitude;
    private BigDecimal longitude;
    private String effectiveStatus;
    private String maskedMsisdn;
    private Instant lastSeenAt;
    private Long depotId;
}
