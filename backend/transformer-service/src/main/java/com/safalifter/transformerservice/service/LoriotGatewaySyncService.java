package com.safalifter.transformerservice.service;

import com.safalifter.transformerservice.config.AccessScopeService;
import com.safalifter.transformerservice.entities.Gateway;
import com.safalifter.transformerservice.entities.GatewaySyncRun;
import com.safalifter.transformerservice.enums.GatewayLocationSource;
import com.safalifter.transformerservice.enums.GatewaySyncRunStatus;
import com.safalifter.transformerservice.integration.loriot.LoriotClientAdapter;
import com.safalifter.transformerservice.integration.loriot.LoriotGateway;
import com.safalifter.transformerservice.integration.loriot.LoriotProperties;
import com.safalifter.transformerservice.repository.GatewayRepository;
import com.safalifter.transformerservice.repository.GatewaySyncRunRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;

@Service
@RequiredArgsConstructor
@Slf4j
public class LoriotGatewaySyncService {

    private final GatewayRepository gatewayRepository;
    private final GatewaySyncRunRepository syncRunRepository;
    private final LoriotClientAdapter clientAdapter;
    private final GatewayStatusService gatewayStatusService;
    private final AccessScopeService accessScopeService;
    private final LoriotProperties properties;

    private final AtomicBoolean inProgress = new AtomicBoolean(false);

    @EventListener(ApplicationReadyEvent.class)
    @Async
    public void onApplicationReady() {
        try {
            Thread.sleep(15_000L);
        } catch (InterruptedException ignored) {
            Thread.currentThread().interrupt();
        }
        try {
            runSync(false);
        } catch (Exception e) {
            log.warn("Initial LORIOT sync run failed silently", e);
        }
    }

    @Scheduled(fixedDelayString = "${loriot.gateway-sync-interval-ms:300000}")
    public void scheduledSync() {
        runSync(false);
    }

    @Transactional
    public Long triggerManualSync() {
        if (accessScopeService.isSupplierScoped()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Supplier users cannot trigger sync");
        }
        if (!inProgress.compareAndSet(false, true)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A gateway sync is already in progress");
        }
        try {
            GatewaySyncRun run = createRun();
            runAsync(run.getId());
            return run.getId();
        } catch (Exception e) {
            inProgress.set(false);
            throw e;
        }
    }

    @Async
    public void runAsync(Long runId) {
        try {
            doRunSync(runId);
        } finally {
            inProgress.set(false);
        }
    }

    public GatewaySyncRun runSync(boolean manual) {
        if (!inProgress.compareAndSet(false, true)) {
            log.debug("LORIOT sync skipped: already in progress");
            return null;
        }
        try {
            GatewaySyncRun run = createRun();
            doRunSync(run.getId());
            return run;
        } finally {
            inProgress.set(false);
        }
    }

    private GatewaySyncRun createRun() {
        GatewaySyncRun run = GatewaySyncRun.builder()
                .status(GatewaySyncRunStatus.RUNNING)
                .countCreated(0)
                .countUpdated(0)
                .countUnchanged(0)
                .countFailed(0)
                .startedAt(Instant.now())
                .build();
        return syncRunRepository.save(run);
    }

    private void doRunSync(Long runId) {
        List<LoriotGateway> fetched;
        GatewaySyncRun run = syncRunRepository.findById(runId).orElseThrow();
        int created = 0;
        int updated = 0;
        int unchanged = 0;
        int failed = 0;
        try {
            fetched = clientAdapter.fetchGateways();
        } catch (Exception e) {
            log.error("LORIOT sync: fetch failed catastrophically", e);
            finalizeRun(runId, GatewaySyncRunStatus.FAILED, created, updated, unchanged, failed, truncate(e.getMessage(), 1800));
            return;
        }
        try {
            for (LoriotGateway dto : fetched) {
                try {
                    SyncOutcome outcome = upsertOne(dto, runId);
                    switch (outcome) {
                        case CREATED -> created++;
                        case UPDATED -> updated++;
                        case UNCHANGED -> unchanged++;
                        case FAILED -> failed++;
                    }
                } catch (Exception e) {
                    failed++;
                    log.warn("LORIOT sync failed to process gateway id={} name={}", dto.getId(), dto.getName(), e);
                }
            }
            GatewaySyncRunStatus status = failed > 0 && (created + updated + unchanged) > 0
                    ? GatewaySyncRunStatus.PARTIAL
                    : failed > 0
                    ? GatewaySyncRunStatus.FAILED
                    : GatewaySyncRunStatus.SUCCESS;
            finalizeRun(runId, status, created, updated, unchanged, failed, null);
        } catch (Exception e) {
            log.error("LORIOT sync: upsert loop failed", e);
            finalizeRun(runId, GatewaySyncRunStatus.FAILED, created, updated, unchanged, failed, truncate(e.getMessage(), 1800));
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public SyncOutcome upsertOne(LoriotGateway dto, Long runId) {
        Gateway existing = findExisting(dto);
        if (existing == null) {
            Gateway created = createFromDto(dto, runId);
            return SyncOutcome.CREATED;
        }
        boolean changed = mergeFromDto(existing, dto, runId);
        return changed ? SyncOutcome.UPDATED : SyncOutcome.UNCHANGED;
    }

    private Gateway findExisting(LoriotGateway dto) {
        String loriotId = trimToNull(dto.getId());
        String normEui = normalizeEuiSafe(dto.getGweui());
        String normMac = normalizeMacSafe(dto.getMac());
        if (loriotId != null) {
            Optional<Gateway> g = gatewayRepository.findByLoriotGatewayId(loriotId);
            if (g.isPresent()) return g.get();
        }
        if (normEui != null) {
            Optional<Gateway> g = gatewayRepository.findByNormalizedGatewayEui(normEui);
            if (g.isPresent()) return g.get();
        }
        if (normMac != null) {
            Optional<Gateway> g = gatewayRepository.findByNormalizedMac(normMac);
            if (g.isPresent()) return g.get();
        }
        return null;
    }

    @Transactional
    public Gateway createFromDto(LoriotGateway dto, Long runId) {
        Gateway g = new Gateway();
        String normEui = normalizeEuiSafe(dto.getGweui());
        String normMac = normalizeMacSafe(dto.getMac());
        g.setLoriotGatewayId(trimToNull(dto.getId()));
        g.setNetworkId(trimToNull(firstNonNull(dto.getNetworkId(), properties.getNetworkId())));
        g.setName(trimToNull(dto.getName()));
        g.setGatewayEui(trimToNull(dto.getGweui()));
        g.setNormalizedGatewayEui(normEui);
        g.setMacAddress(trimToNull(dto.getMac()));
        g.setNormalizedMac(normMac);
        g.setSerialNumber(trimToNull(dto.getSerial()));
        g.setImei(trimToNull(dto.getImei()));
        g.setManufacturer(trimToNull(dto.getManufacturer()));
        g.setModel(trimToNull(dto.getModel()));
        g.setFirmwareVersion(trimToNull(firstNonNull(dto.getFwVersion(), dto.getFw())));
        g.setPacketForwarderVersion(trimToNull(dto.getPacketForwarderVersion()));
        if (dto.getLatitude() != null) g.setLatitude(dto.getLatitude());
        if (dto.getLongitude() != null) g.setLongitude(dto.getLongitude());
        if (dto.getAltitude() != null) g.setAltitude(dto.getAltitude());
        if (dto.getAddress() != null && g.getAddress() == null) g.setAddress(dto.getAddress());
        if ((dto.getLatitude() != null || dto.getLongitude() != null) && g.getLocationSource() == null) {
            g.setLocationSource(GatewayLocationSource.LORIOT);
        }
        g.setLastSyncRunId(runId);
        g.setLastSyncAt(Instant.now());
        g.setEffectiveStatus(com.safalifter.transformerservice.enums.GatewayStatus.UNKNOWN);
        g = gatewayRepository.save(g);
        try {
            gatewayStatusService.updateFromLoriotApi(g, dto);
        } catch (Exception e) {
            log.warn("Status update failed during create for gateway id={}", g.getId(), e);
        }
        return g;
    }

    @Transactional
    public boolean mergeFromDto(Gateway g, LoriotGateway dto, Long runId) {
        boolean changed = false;
        String incomingLoriotId = trimToNull(dto.getId());
        if (incomingLoriotId != null && !Objects.equals(g.getLoriotGatewayId(), incomingLoriotId)) {
            g.setLoriotGatewayId(incomingLoriotId);
            changed = true;
        }
        String netId = trimToNull(dto.getNetworkId());
        if (netId != null && isNullOrBlank(g.getNetworkId())) {
            g.setNetworkId(netId);
            changed = true;
        }
        if (shouldOverwrite(g.getName(), dto.getName())) {
            g.setName(trimToNull(dto.getName()));
            changed = true;
        }
        if (g.getGatewayEui() == null && dto.getGweui() != null) {
            g.setGatewayEui(trimToNull(dto.getGweui()));
            changed = true;
        }
        String normEui = normalizeEuiSafe(dto.getGweui());
        if (normEui != null && !Objects.equals(g.getNormalizedGatewayEui(), normEui)) {
            g.setNormalizedGatewayEui(normEui);
            changed = true;
        }
        if (g.getMacAddress() == null && dto.getMac() != null) {
            g.setMacAddress(trimToNull(dto.getMac()));
            changed = true;
        }
        String normMac = normalizeMacSafe(dto.getMac());
        if (normMac != null && !Objects.equals(g.getNormalizedMac(), normMac)) {
            g.setNormalizedMac(normMac);
            changed = true;
        }
        if (shouldOverwrite(g.getSerialNumber(), dto.getSerial())) {
            g.setSerialNumber(trimToNull(dto.getSerial()));
            changed = true;
        }
        if (shouldOverwrite(g.getImei(), dto.getImei())) {
            g.setImei(trimToNull(dto.getImei()));
            changed = true;
        }
        if (shouldOverwrite(g.getManufacturer(), dto.getManufacturer())) {
            g.setManufacturer(trimToNull(dto.getManufacturer()));
            changed = true;
        }
        if (shouldOverwrite(g.getModel(), dto.getModel())) {
            g.setModel(trimToNull(dto.getModel()));
            changed = true;
        }
        String fw = firstNonNull(dto.getFwVersion(), dto.getFw());
        if (shouldOverwrite(g.getFirmwareVersion(), fw)) {
            g.setFirmwareVersion(trimToNull(fw));
            changed = true;
        }
        if (shouldOverwrite(g.getPacketForwarderVersion(), dto.getPacketForwarderVersion())) {
            g.setPacketForwarderVersion(trimToNull(dto.getPacketForwarderVersion()));
            changed = true;
        }
        boolean skipLocation = g.getLocationSource() == GatewayLocationSource.MANUAL
                || g.getLocationSource() == GatewayLocationSource.GPS
                || Boolean.TRUE.equals(g.getLocationVerified());
        if (!skipLocation) {
            if (dto.getLatitude() != null && (g.getLatitude() == null || g.getLocationSource() == null || g.getLocationSource() == GatewayLocationSource.LORIOT)) {
                if (!Objects.equals(g.getLatitude(), dto.getLatitude())) {
                    g.setLatitude(dto.getLatitude());
                    changed = true;
                }
            }
            if (dto.getLongitude() != null && (g.getLongitude() == null || g.getLocationSource() == null || g.getLocationSource() == GatewayLocationSource.LORIOT)) {
                if (!Objects.equals(g.getLongitude(), dto.getLongitude())) {
                    g.setLongitude(dto.getLongitude());
                    changed = true;
                }
            }
            if (dto.getAltitude() != null && (g.getAltitude() == null || g.getLocationSource() == GatewayLocationSource.LORIOT)) {
                if (!Objects.equals(g.getAltitude(), dto.getAltitude())) {
                    g.setAltitude(dto.getAltitude());
                    changed = true;
                }
            }
            if (shouldOverwrite(g.getAddress(), dto.getAddress())) {
                g.setAddress(trimToNull(dto.getAddress()));
                changed = true;
            }
            if ((dto.getLatitude() != null || dto.getLongitude() != null) && g.getLocationSource() == null) {
                g.setLocationSource(GatewayLocationSource.LORIOT);
                changed = true;
            }
        }
        g.setLastSyncRunId(runId);
        g.setLastSyncAt(Instant.now());
        if (changed) {
            gatewayRepository.save(g);
        }
        try {
            gatewayStatusService.updateFromLoriotApi(g, dto);
        } catch (Exception e) {
            log.warn("Status update failed during merge for gateway id={}", g.getId(), e);
        }
        return changed;
    }

    @Transactional
    public void finalizeRun(Long runId, GatewaySyncRunStatus status, int created, int updated, int unchanged, int failed, String errorSummary) {
        GatewaySyncRun run = syncRunRepository.findById(runId).orElse(null);
        if (run == null) return;
        run.setStatus(status);
        run.setCountCreated(created);
        run.setCountUpdated(updated);
        run.setCountUnchanged(unchanged);
        run.setCountFailed(failed);
        run.setErrorSummary(errorSummary);
        run.setFinishedAt(Instant.now());
        syncRunRepository.save(run);
        log.info("LORIOT sync run id={} finished status={} created={} updated={} unchanged={} failed={}",
                runId, status, created, updated, unchanged, failed);
    }

    private boolean shouldOverwrite(String stored, String incoming) {
        if (isNullOrBlank(incoming)) return false;
        return isNullOrBlank(stored);
    }

    private static boolean isNullOrBlank(String s) {
        return s == null || s.isBlank();
    }

    private static String trimToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private static String firstNonNull(String... candidates) {
        for (String c : candidates) {
            if (c != null && !c.isBlank()) return c;
        }
        return null;
    }

    public static String normalizeEuiSafe(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return GatewayStatusService.normalizeEui(raw);
        } catch (Exception e) {
            return null;
        }
    }

    public static String normalizeMacSafe(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return GatewayStatusService.normalizeMac(raw);
        } catch (Exception e) {
            return null;
        }
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        if (s.length() <= max) return s;
        return s.substring(0, max) + "…[truncated]";
    }

    public enum SyncOutcome {
        CREATED, UPDATED, UNCHANGED, FAILED
    }
}
