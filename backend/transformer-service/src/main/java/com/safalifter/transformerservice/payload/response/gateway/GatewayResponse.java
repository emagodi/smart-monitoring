package com.safalifter.transformerservice.payload.response.gateway;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
public class GatewayResponse {
    private Long id;
    private String loriotGatewayId;
    private String networkId;
    private String name;
    private String description;
    private String gatewayEui;
    private String normalizedGatewayEui;
    private String macAddress;
    private String normalizedMac;
    private String serialNumber;
    private String imei;
    private String manufacturer;
    private String model;
    private String firmwareVersion;
    private String packetForwarderVersion;
    private String loriotReportedStatus;
    private String computedStatus;
    private String effectiveStatus;
    private Instant lastLoriotSeenAt;
    private Instant lastTrafficSeenAt;
    private Instant lastHealthCheckAt;
    private Instant lastSeenAt;
    private Instant statusChangedAt;
    private String statusReason;
    private Long lastSyncRunId;
    private Instant lastSyncAt;
    private BigDecimal latitude;
    private BigDecimal longitude;
    private BigDecimal altitude;
    private String address;
    private String locationSource;
    private boolean locationVerified;
    private Instant locationVerifiedAt;
    private String locationVerifiedBy;
    private String customer;
    private Long regionId;
    private Long districtId;
    private Long depotId;
    private Long siteId;
    private LocalDate commissioningDate;
    private boolean decommissioned;
    private Instant decommissionedAt;
    private String decommissionedReason;
    private Long activeSimId;
    private String assignedMsisdn;
    private String createdBy;
    private LocalDateTime createdAt;
    private String updatedBy;
    private LocalDateTime updatedAt;
}
