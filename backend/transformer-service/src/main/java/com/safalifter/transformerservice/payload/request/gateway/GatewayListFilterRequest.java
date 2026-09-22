package com.safalifter.transformerservice.payload.request.gateway;

import com.safalifter.transformerservice.enums.GatewayStatus;
import lombok.Data;

import java.time.Instant;

@Data
public class GatewayListFilterRequest {
    private GatewayStatus status;
    private String search;
    private String networkId;
    private String model;
    private Long regionId;
    private Long districtId;
    private Long depotId;
    private Instant lastSeenFrom;
    private Instant lastSeenTo;
}
