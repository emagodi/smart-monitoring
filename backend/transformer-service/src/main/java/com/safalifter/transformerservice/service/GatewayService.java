package com.safalifter.transformerservice.service;

import com.safalifter.transformerservice.config.AccessScopeService;
import com.safalifter.transformerservice.entities.Gateway;
import com.safalifter.transformerservice.entities.GatewayStatusHistory;
import com.safalifter.transformerservice.entities.GatewaySimAssignment;
import com.safalifter.transformerservice.entities.SimCard;
import com.safalifter.transformerservice.enums.GatewayLocationSource;
import com.safalifter.transformerservice.enums.GatewayStatus;
import com.safalifter.transformerservice.enums.GatewayStatusSource;
import com.safalifter.transformerservice.enums.SimCardStatus;
import com.safalifter.transformerservice.payload.request.gateway.*;
import com.safalifter.transformerservice.payload.response.gateway.*;
import com.safalifter.transformerservice.repository.GatewayRepository;
import com.safalifter.transformerservice.repository.GatewaySimAssignmentRepository;
import com.safalifter.transformerservice.repository.GatewayStatusHistoryRepository;
import com.safalifter.transformerservice.repository.GatewaySyncRunRepository;
import com.safalifter.transformerservice.repository.SimCardRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class GatewayService {

    private final GatewayRepository gatewayRepository;
    private final GatewayStatusHistoryRepository statusHistoryRepository;
    private final GatewaySyncRunRepository syncRunRepository;
    private final GatewaySimAssignmentRepository assignmentRepository;
    private final SimCardRepository simCardRepository;
    private final AccessScopeService accessScopeService;
    private final LoriotGatewaySyncService syncService;
    private final GatewayStatusService statusService;

    @Transactional(readOnly = true)
    public GatewaySummaryResponse getSummary() {
        Map<GatewayStatus, Long> counts = new EnumMap<>(GatewayStatus.class);
        for (GatewayStatus s : GatewayStatus.values()) counts.put(s, 0L);
        List<Object[]> raw = gatewayRepository.countByEffectiveStatus();
        for (Object[] row : raw) {
            if (row[0] instanceof GatewayStatus s) counts.put(s, ((Number) row[1]).longValue());
        }
        long missingLocation = orZero(gatewayRepository.countMissingLocation());
        long missingSim = orZero(gatewayRepository.countMissingSim());
        long total = counts.values().stream().mapToLong(v -> v).sum();
        var lastRun = syncRunRepository.findTop5ByOrderByStartedAtDesc().stream().findFirst().orElse(null);
        return GatewaySummaryResponse.builder()
                .total(total)
                .online(counts.getOrDefault(GatewayStatus.ONLINE, 0L))
                .offline(counts.getOrDefault(GatewayStatus.OFFLINE, 0L))
                .degraded(counts.getOrDefault(GatewayStatus.DEGRADED, 0L))
                .neverSeen(counts.getOrDefault(GatewayStatus.NEVER_SEEN, 0L))
                .unknown(counts.getOrDefault(GatewayStatus.UNKNOWN, 0L))
                .missingLocation(missingLocation)
                .missingSim(missingSim)
                .lastSyncStatus(lastRun != null ? lastRun.getStatus().name() : null)
                .lastSyncAt(lastRun != null ? lastRun.getStartedAt() : null)
                .build();
    }

    @Transactional(readOnly = true)
    public Page<GatewayResponse> findPage(GatewayListFilterRequest filter, Pageable pageable) {
        forbidSupplier();
        return gatewayRepository.findWithFilters(
                filter.getStatus(),
                filter.getRegionId(),
                filter.getDistrictId(),
                filter.getDepotId(),
                filter.getNetworkId(),
                filter.getModel(),
                filter.getSearch(),
                filter.getLastSeenFrom(),
                filter.getLastSeenTo(),
                pageable
        ).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public GatewayResponse getById(Long id) {
        forbidSupplier();
        Gateway g = gatewayRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Gateway not found"));
        return toResponse(g);
    }

    @Transactional
    public GatewayResponse create(GatewayCreateRequest request) {
        forbidSupplierCrud();
        String normalizedEui = LoriotGatewaySyncService.normalizeEuiSafe(request.getGatewayEui());
        String normalizedMac = LoriotGatewaySyncService.normalizeMacSafe(request.getMacAddress());
        if (request.getLoriotGatewayId() != null && !request.getLoriotGatewayId().isBlank()) {
            gatewayRepository.findByLoriotGatewayId(request.getLoriotGatewayId()).ifPresent(g -> {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Gateway with this LORIOT id already exists");
            });
        }
        if (normalizedEui != null) {
            final String e = normalizedEui;
            gatewayRepository.findByNormalizedGatewayEui(normalizedEui).ifPresent(g -> {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Gateway with this EUI already exists: " + e);
            });
        }
        Gateway g = new Gateway();
        g.setLoriotGatewayId(trimToNull(request.getLoriotGatewayId()));
        g.setNetworkId(trimToNull(request.getNetworkId()));
        g.setName(request.getName());
        g.setDescription(trimToNull(request.getDescription()));
        g.setGatewayEui(trimToNull(request.getGatewayEui()));
        g.setNormalizedGatewayEui(normalizedEui);
        g.setMacAddress(trimToNull(request.getMacAddress()));
        g.setNormalizedMac(normalizedMac);
        g.setSerialNumber(trimToNull(request.getSerialNumber()));
        g.setImei(trimToNull(request.getImei()));
        g.setManufacturer(trimToNull(request.getManufacturer()));
        g.setModel(trimToNull(request.getModel()));
        g.setFirmwareVersion(trimToNull(request.getFirmwareVersion()));
        g.setLatitude(request.getLatitude());
        g.setLongitude(request.getLongitude());
        g.setAltitude(request.getAltitude());
        g.setAddress(trimToNull(request.getAddress()));
        if (request.getLatitude() != null || request.getLongitude() != null) {
            g.setLocationSource(request.getLocationSource() != null ? request.getLocationSource() : GatewayLocationSource.MANUAL);
        }
        g.setCustomer(trimToNull(request.getCustomer()));
        g.setRegionId(request.getRegionId());
        g.setDistrictId(request.getDistrictId());
        g.setDepotId(request.getDepotId());
        g.setCommissioningDate(request.getCommissioningDate());
        g.setEffectiveStatus(GatewayStatus.NEVER_SEEN);
        g.setCreatedBy(accessScopeService.getCurrentUserEmail());
        Gateway saved = gatewayRepository.save(g);
        log.info("Created gateway id={} name={} by={}", saved.getId(), saved.getName(), accessScopeService.getCurrentUserEmail());
        return toResponse(saved);
    }

    @Transactional
    public GatewayResponse update(Long id, GatewayUpdateRequest request) {
        forbidSupplierCrud();
        Gateway g = gatewayRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Gateway not found"));
        g.setName(request.getName());
        g.setDescription(trimToNull(request.getDescription()));
        g.setAddress(trimToNull(request.getAddress()));
        g.setCustomer(trimToNull(request.getCustomer()));
        g.setRegionId(request.getRegionId());
        g.setDistrictId(request.getDistrictId());
        g.setDepotId(request.getDepotId());
        g.setCommissioningDate(request.getCommissioningDate());
        if (request.getLatitude() != null || request.getLongitude() != null) {
            boolean locChanged = !Objects.equals(g.getLatitude(), request.getLatitude())
                    || !Objects.equals(g.getLongitude(), request.getLongitude());
            g.setLatitude(request.getLatitude());
            g.setLongitude(request.getLongitude());
            g.setAltitude(request.getAltitude());
            g.setLocationSource(GatewayLocationSource.MANUAL);
            if (Boolean.TRUE.equals(request.getLocationVerified())) {
                g.setLocationVerified(true);
                g.setLocationVerifiedAt(Instant.now());
                g.setLocationVerifiedBy(accessScopeService.getCurrentUserEmail());
            }
            if (locChanged) {
                log.info("Gateway id={} location updated by={}", id, accessScopeService.getCurrentUserEmail());
            }
        }
        g.setUpdatedBy(accessScopeService.getCurrentUserEmail());
        Gateway saved = gatewayRepository.save(g);
        return toResponse(saved);
    }

    @Transactional
    public void decommission(Long id, GatewayDecommissionRequest request) {
        forbidSupplierCrud();
        Gateway g = gatewayRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Gateway not found"));
        GatewayStatus prev = g.getEffectiveStatus();
        g.setDecommissioned(true);
        g.setDecommissionedAt(Instant.now());
        g.setDecommissionedReason(trimToNull(request.getReason()));
        g.setUpdatedBy(accessScopeService.getCurrentUserEmail());
        GatewayStatus newStatus = prev != null && prev != GatewayStatus.NEVER_SEEN ? GatewayStatus.UNKNOWN : GatewayStatus.NEVER_SEEN;
        g.setEffectiveStatus(newStatus);
        g.setStatusChangedAt(Instant.now());
        g.setStatusReason("decommissioned: " + trimToNull(request.getReason()));
        statusHistoryRepository.save(GatewayStatusHistory.builder()
                .gatewayId(id)
                .prevStatus(prev)
                .newStatus(newStatus)
                .source(GatewayStatusSource.MANUAL)
                .reason("decommissioned: " + trimToNull(request.getReason()))
                .observedAt(Instant.now())
                .build());
        gatewayRepository.save(g);
        log.info("Gateway id={} decommissioned by={}", id, accessScopeService.getCurrentUserEmail());
    }

    @Transactional(readOnly = true)
    public List<GatewayMapPointResponse> getMapPoints() {
        forbidSupplier();
        List<Gateway> gateways = gatewayRepository.findAllMapPoints();
        List<GatewayMapPointResponse> result = new ArrayList<>();
        for (Gateway g : gateways) {
            if (g.getLatitude() == null || g.getLongitude() == null) continue;
            if (BigDecimal.ZERO.equals(g.getLatitude()) && BigDecimal.ZERO.equals(g.getLongitude())) continue;
            String msisdn = resolveActiveAssignedMsisdn(g.getId());
            Instant lastSeen = latest(g.getLastTrafficSeenAt(), g.getLastLoriotSeenAt());
            result.add(GatewayMapPointResponse.builder()
                    .id(g.getId())
                    .name(g.getName())
                    .latitude(g.getLatitude())
                    .longitude(g.getLongitude())
                    .effectiveStatus(g.getEffectiveStatus() != null ? g.getEffectiveStatus().name() : null)
                    .maskedMsisdn(maskMsisdn(msisdn))
                    .lastSeenAt(lastSeen)
                    .depotId(g.getDepotId())
                    .build());
        }
        return result;
    }

    @Transactional(readOnly = true)
    public Page<GatewayStatusHistoryResponse> getStatusHistory(Long id, Pageable pageable) {
        forbidSupplier();
        gatewayRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Gateway not found"));
        return statusHistoryRepository.findByGatewayIdOrderByObservedAtDesc(id, pageable)
                .map(h -> GatewayStatusHistoryResponse.builder()
                        .id(h.getId())
                        .prevStatus(h.getPrevStatus() != null ? h.getPrevStatus().name() : null)
                        .newStatus(h.getNewStatus() != null ? h.getNewStatus().name() : null)
                        .reason(h.getReason())
                        .source(h.getSource() != null ? h.getSource().name() : null)
                        .observedAt(h.getObservedAt())
                        .build());
    }

    private GatewayResponse toResponse(Gateway g) {
        String simMsisdn = resolveActiveAssignedMsisdn(g.getId());
        Long activeSimId = resolveActiveAssignedSimId(g.getId());
        Instant lastSeen = latest(g.getLastTrafficSeenAt(), g.getLastLoriotSeenAt());
        return GatewayResponse.builder()
                .id(g.getId())
                .loriotGatewayId(g.getLoriotGatewayId())
                .networkId(g.getNetworkId())
                .name(g.getName())
                .description(g.getDescription())
                .gatewayEui(g.getGatewayEui())
                .normalizedGatewayEui(g.getNormalizedGatewayEui())
                .macAddress(g.getMacAddress())
                .normalizedMac(g.getNormalizedMac())
                .serialNumber(g.getSerialNumber())
                .imei(g.getImei())
                .manufacturer(g.getManufacturer())
                .model(g.getModel())
                .firmwareVersion(g.getFirmwareVersion())
                .packetForwarderVersion(g.getPacketForwarderVersion())
                .loriotReportedStatus(g.getLoriotReportedStatus() != null ? g.getLoriotReportedStatus().name() : null)
                .computedStatus(g.getComputedStatus() != null ? g.getComputedStatus().name() : null)
                .effectiveStatus(g.getEffectiveStatus() != null ? g.getEffectiveStatus().name() : null)
                .lastLoriotSeenAt(g.getLastLoriotSeenAt())
                .lastTrafficSeenAt(g.getLastTrafficSeenAt())
                .lastHealthCheckAt(g.getLastHealthCheckAt())
                .lastSeenAt(lastSeen)
                .statusChangedAt(g.getStatusChangedAt())
                .statusReason(g.getStatusReason())
                .lastSyncRunId(g.getLastSyncRunId())
                .lastSyncAt(g.getLastSyncAt())
                .latitude(g.getLatitude())
                .longitude(g.getLongitude())
                .altitude(g.getAltitude())
                .address(g.getAddress())
                .locationSource(g.getLocationSource() != null ? g.getLocationSource().name() : null)
                .locationVerified(Boolean.TRUE.equals(g.getLocationVerified()))
                .locationVerifiedAt(g.getLocationVerifiedAt())
                .locationVerifiedBy(g.getLocationVerifiedBy())
                .customer(g.getCustomer())
                .regionId(g.getRegionId())
                .districtId(g.getDistrictId())
                .depotId(g.getDepotId())
                .siteId(g.getSiteId())
                .commissioningDate(g.getCommissioningDate())
                .decommissioned(Boolean.TRUE.equals(g.getDecommissioned()))
                .decommissionedAt(g.getDecommissionedAt())
                .decommissionedReason(g.getDecommissionedReason())
                .activeSimId(activeSimId)
                .assignedMsisdn(maskMsisdn(simMsisdn))
                .createdBy(g.getCreatedBy())
                .createdAt(g.getCreatedAt())
                .updatedBy(g.getUpdatedBy())
                .updatedAt(g.getUpdatedAt())
                .build();
    }

    private String resolveActiveAssignedMsisdn(Long gatewayId) {
        Optional<GatewaySimAssignment> a = assignmentRepository.findActiveByGatewayId(gatewayId);
        if (a.isEmpty()) return null;
        Long simId = a.get().getSimId();
        return simCardRepository.findById(simId).map(SimCard::getMsisdn).orElse(null);
    }

    private Long resolveActiveAssignedSimId(Long gatewayId) {
        return assignmentRepository.findActiveByGatewayId(gatewayId)
                .map(GatewaySimAssignment::getSimId).orElse(null);
    }

    private static Instant latest(Instant a, Instant b) {
        if (a == null) return b;
        if (b == null) return a;
        return a.isAfter(b) ? a : b;
    }

    private static String maskMsisdn(String msisdn) {
        if (msisdn == null || msisdn.length() < 4) return msisdn;
        int keep = Math.min(4, msisdn.length());
        return "*".repeat(msisdn.length() - keep) + msisdn.substring(msisdn.length() - keep);
    }

    private void forbidSupplier() {
        if (accessScopeService.isSupplierScoped()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Supplier users cannot access gateway inventory");
        }
    }

    private void forbidSupplierCrud() {
        if (accessScopeService.isSupplierScoped()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Supplier users cannot create, edit, or delete gateways");
        }
    }

    private static long orZero(Long l) {
        return l == null ? 0L : l;
    }

    private static String trimToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
