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
    private String operator;
    private Boolean hasLocation;
    private Boolean hasSim;
    /** true: gateways that have relayed transformer uplinks; false: never relayed any. */
    private Boolean relaying;
    private String regionName;
    private String depotName;
    private String networkName;
}
