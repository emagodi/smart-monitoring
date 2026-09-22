package com.safalifter.transformerservice.entities;

import com.safalifter.transformerservice.enums.GatewayLocationSource;
import com.safalifter.transformerservice.enums.GatewayStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "gateways", uniqueConstraints = {
        @UniqueConstraint(name = "uk_gateways_loriot_gateway_id", columnNames = {"loriot_gateway_id"}),
        @UniqueConstraint(name = "uk_gateways_normalized_gateway_eui", columnNames = {"normalized_gateway_eui"})
}, indexes = {
        @Index(name = "idx_gateways_effective_status", columnList = "effective_status"),
        @Index(name = "idx_gateways_region_id", columnList = "region_id"),
        @Index(name = "idx_gateways_depot_id", columnList = "depot_id"),
        @Index(name = "idx_gateways_last_traffic_seen_at", columnList = "last_traffic_seen_at"),
        @Index(name = "idx_gateways_last_loriot_seen_at", columnList = "last_loriot_seen_at"),
        @Index(name = "idx_gateways_normalized_mac", columnList = "normalized_mac")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Gateway {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "loriot_gateway_id", length = 64)
    private String loriotGatewayId;

    @Column(name = "network_id", length = 32)
    private String networkId;

    @Column(name = "name")
    private String name;

    @Column(name = "description", length = 1000)
    private String description;

    @Column(name = "gateway_eui", length = 64)
    private String gatewayEui;

    @Column(name = "normalized_gateway_eui", length = 32)
    private String normalizedGatewayEui;

    @Column(name = "mac_address", length = 64)
    private String macAddress;

    @Column(name = "normalized_mac", length = 32)
    private String normalizedMac;

    @Column(name = "serial_number", length = 128)
    private String serialNumber;

    @Column(name = "imei", length = 32)
    private String imei;

    @Column(name = "manufacturer", length = 128)
    private String manufacturer;

    @Column(name = "model", length = 128)
    private String model;

    @Column(name = "firmware_version", length = 64)
    private String firmwareVersion;

    @Column(name = "packet_forwarder_version", length = 64)
    private String packetForwarderVersion;

    @Enumerated(EnumType.STRING)
    @Column(name = "loriot_reported_status", length = 32)
    private GatewayStatus loriotReportedStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "computed_status", length = 32)
    private GatewayStatus computedStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "effective_status", length = 32)
    private GatewayStatus effectiveStatus;

    @Column(name = "last_loriot_seen_at")
    private Instant lastLoriotSeenAt;

    @Column(name = "last_traffic_seen_at")
    private Instant lastTrafficSeenAt;

    @Column(name = "last_health_check_at")
    private Instant lastHealthCheckAt;

    @Column(name = "status_changed_at")
    private Instant statusChangedAt;

    @Column(name = "status_reason", length = 500)
    private String statusReason;

    @Column(name = "last_sync_run_id")
    private Long lastSyncRunId;

    @Column(name = "last_sync_at")
    private Instant lastSyncAt;

    @Column(name = "latitude", precision = 10, scale = 6)
    private BigDecimal latitude;

    @Column(name = "longitude", precision = 10, scale = 6)
    private BigDecimal longitude;

    @Column(name = "altitude", precision = 10, scale = 2)
    private BigDecimal altitude;

    @Column(name = "address", length = 500)
    private String address;

    @Enumerated(EnumType.STRING)
    @Column(name = "location_source", length = 32)
    private GatewayLocationSource locationSource;

    @Column(name = "location_verified")
    private Boolean locationVerified;

    @Column(name = "location_verified_at")
    private Instant locationVerifiedAt;

    @Column(name = "location_verified_by", length = 255)
    private String locationVerifiedBy;

    @Column(name = "customer", length = 255)
    private String customer;

    @Column(name = "region_id")
    private Long regionId;

    @Column(name = "district_id")
    private Long districtId;

    @Column(name = "depot_id")
    private Long depotId;

    @Column(name = "site_id")
    private Long siteId;

    @Column(name = "commissioning_date")
    private LocalDate commissioningDate;

    @Column(name = "decommissioned")
    private Boolean decommissioned;

    @Column(name = "decommissioned_at")
    private Instant decommissionedAt;

    @Column(name = "decommissioned_reason", length = 500)
    private String decommissionedReason;

    @Column(name = "created_by", length = 255)
    private String createdBy;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_by", length = 255)
    private String updatedBy;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Version
    @Column(name = "version")
    private Long version;
}
