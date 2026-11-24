package com.safalifter.transformerservice.service;

import com.safalifter.transformerservice.config.AccessScopeService;
import com.safalifter.transformerservice.entities.Gateway;
import com.safalifter.transformerservice.entities.GatewaySimAssignment;
import com.safalifter.transformerservice.entities.GatewaySyncRun;
import com.safalifter.transformerservice.enums.GatewayLocationSource;
import com.safalifter.transformerservice.enums.GatewayStatus;
import com.safalifter.transformerservice.enums.GatewaySyncRunStatus;
import com.safalifter.transformerservice.enums.SimCardStatus;
import com.safalifter.transformerservice.repository.GatewayRepository;
import com.safalifter.transformerservice.repository.GatewaySimAssignmentRepository;
import com.safalifter.transformerservice.repository.GatewaySyncRunRepository;
import com.safalifter.transformerservice.repository.SimCardRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

/**
 * Keeping the gateway list clean when gateways are deleted / re-registered in LORIOT:
 * <ul>
 *   <li>{@link #duplicates()} finds records that are probably the same physical gateway (same MAC / serial / IMEI,
 *       EUI one character apart, same name), and suggests which one to keep.</li>
 *   <li>{@link #merge} moves the SIM, location, depot assignment and transformer coverage of one record into the other,
 *       then removes it, with the move recorded in the audit trail.</li>
 *   <li>{@link #delete} removes a gateway record (refused while LORIOT still lists it, because the next sync would
 *       bring it straight back).</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class GatewayMaintenanceService {

    private final GatewayRepository gatewayRepository;
    private final GatewaySyncRunRepository syncRunRepository;
    private final GatewaySimAssignmentRepository assignmentRepository;
    private final SimCardRepository simCardRepository;
    private final AccessScopeService scope;
    private final GatewayChangeLogService changeLog;
    private final NamedParameterJdbcTemplate jdbc;

    public record MergeRequest(Long targetId, Boolean force, String note) {}

    public record DeleteRequest(String reason) {}

    private volatile Long latestRunCache;
    private volatile long latestRunAt;

    // ------------------------------------------------------------------ LORIOT presence

    /** Id of the newest finished LORIOT sync; gateways it (or a newer run) touched are still listed in LORIOT. */
    public Long latestFinishedRunId() {
        long now = System.currentTimeMillis();
        if (now - latestRunAt < 15_000) return latestRunCache;
        Long id = syncRunRepository.findTop5ByOrderByStartedAtDesc().stream()
                .filter(r -> r.getStatus() == GatewaySyncRunStatus.SUCCESS || r.getStatus() == GatewaySyncRunStatus.PARTIAL)
                .map(GatewaySyncRun::getId).findFirst().orElse(null);
        latestRunCache = id;
        latestRunAt = now;
        return id;
    }

    /** true: LORIOT listed it at the last sync. false: removed there, or never came from LORIOT. */
    public boolean inLoriot(Gateway g) {
        if (g == null || g.getLoriotGatewayId() == null || g.getLastSyncRunId() == null) return false;
        Long latest = latestFinishedRunId();
        return latest == null || g.getLastSyncRunId() >= latest;
    }

    // ------------------------------------------------------------------ duplicates

    public List<Map<String, Object>> duplicates() {
        forbidSupplier();
        List<Gateway> all = gatewayRepository.findAll();
        Long depot = scope.getCurrentDepotId();
        if (depot != null) all = all.stream().filter(g -> depot.equals(g.getDepotId())).toList();
        List<Map<String, Object>> out = new ArrayList<>();
        for (int i = 0; i < all.size(); i++) {
            for (int j = i + 1; j < all.size(); j++) {
                Gateway a = all.get(i);
                Gateway b = all.get(j);
                List<String> reasons = reasons(a, b);
                if (reasons.isEmpty()) continue;
                Gateway keep = preferred(a, b);
                Gateway drop = keep == a ? b : a;
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("keep", summary(keep));
                m.put("remove", summary(drop));
                m.put("reasons", reasons);
                out.add(m);
            }
        }
        return out;
    }

    private List<String> reasons(Gateway a, Gateway b) {
        List<String> r = new ArrayList<>();
        if (eq(a.getNormalizedMac(), b.getNormalizedMac())) r.add("Same MAC address");
        if (eq(a.getNormalizedGatewayEui(), b.getNormalizedGatewayEui())) r.add("Same gateway EUI");
        else if (oneApart(a.getNormalizedGatewayEui(), b.getNormalizedGatewayEui())) r.add("Gateway EUI differs by one character (likely a typo when registering)");
        if (eq(norm(a.getSerialNumber()), norm(b.getSerialNumber()))) r.add("Same serial number");
        if (eq(norm(a.getImei()), norm(b.getImei()))) r.add("Same IMEI");
        if (eq(nameKey(a.getName()), nameKey(b.getName()))) r.add("Same name");
        return r;
    }

    /** Keep the one LORIOT still lists, then the one online, then the one heard most recently. */
    private Gateway preferred(Gateway a, Gateway b) {
        Comparator<Gateway> c = Comparator
                .comparing((Gateway g) -> inLoriot(g) ? 1 : 0)
                .thenComparing(g -> g.getEffectiveStatus() == GatewayStatus.ONLINE ? 1 : 0)
                .thenComparing(g -> lastSeen(g) == null ? Instant.EPOCH : lastSeen(g));
        return c.compare(a, b) >= 0 ? a : b;
    }

    private Map<String, Object> summary(Gateway g) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", g.getId());
        m.put("name", g.getName());
        m.put("gatewayEui", g.getGatewayEui());
        m.put("macAddress", g.getMacAddress());
        m.put("loriotGatewayId", g.getLoriotGatewayId());
        m.put("effectiveStatus", g.getEffectiveStatus() != null ? g.getEffectiveStatus().name() : null);
        Instant ls = lastSeen(g);
        m.put("lastSeenAt", ls != null ? ls.toString() : null);
        m.put("inLoriot", inLoriot(g));
        m.put("simAssigned", assignmentRepository.findActiveByGatewayId(g.getId()).isPresent());
        m.put("depotName", g.getDepotName());
        m.put("hasLocation", g.getLatitude() != null && g.getLongitude() != null);
        m.put("locationSource", g.getLocationSource() != null ? g.getLocationSource().name() : null);
        m.put("decommissioned", Boolean.TRUE.equals(g.getDecommissioned()));
        return m;
    }

    // ------------------------------------------------------------------ merge

    /** Moves everything worth keeping from {@code sourceId} into the target, then removes the source record. */
    @Transactional
    public Map<String, Object> merge(long sourceId, MergeRequest in) {
        forbidSupplier();
        if (in == null || in.targetId() == null) throw bad("Choose the gateway to keep");
        if (in.targetId() == sourceId) throw bad("A gateway cannot be merged into itself");
        Gateway source = load(sourceId);
        Gateway target = load(in.targetId());
        if (inLoriot(source) && !Boolean.TRUE.equals(in.force())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "\"" + source.getName()
                    + "\" is still registered in LORIOT, so the next sync would bring it back. Delete it in LORIOT first.");
        }
        String actor = scope.getCurrentUserEmail();
        Map<String, String> before = changeLog.snapshot(target);
        List<String> moved = new ArrayList<>();

        // SIM: the active SIM follows the gateway unless the kept one already has its own.
        List<GatewaySimAssignment> sourceAssignments = assignmentRepository.findAll().stream()
                .filter(a -> Objects.equals(a.getGatewayId(), sourceId)).toList();
        boolean targetHasSim = assignmentRepository.findActiveByGatewayId(target.getId()).isPresent();
        for (GatewaySimAssignment a : sourceAssignments) {
            if (Boolean.TRUE.equals(a.getActive()) && targetHasSim) {
                a.setActive(false);
                a.setUnassignedAt(Instant.now());
                a.setUnassignedBy(actor);
                a.setReason("Gateway merged into \"" + target.getName() + "\", which already has a SIM");
                simCardRepository.findById(a.getSimId()).ifPresent(sim -> {
                    sim.setStatus(SimCardStatus.AVAILABLE);
                    sim.setUpdatedBy(actor);
                    simCardRepository.save(sim);
                });
                moved.add("SIM unassigned (the kept gateway already has one)");
            } else {
                if (Boolean.TRUE.equals(a.getActive())) moved.add("SIM card moved");
            }
            a.setGatewayId(target.getId());
            assignmentRepository.save(a);
        }

        // Transformers linked to the gateway by hand.
        int cov = jdbc.update("""
                UPDATE gateway_transformer_coverage SET gateway_id = :t
                 WHERE gateway_id = :s AND transformer_id NOT IN (
                       SELECT transformer_id FROM (SELECT transformer_id FROM gateway_transformer_coverage WHERE gateway_id = :t) x)""",
                Map.of("t", target.getId(), "s", sourceId));
        jdbc.update("DELETE FROM gateway_transformer_coverage WHERE gateway_id = :s", Map.of("s", sourceId));
        if (cov > 0) moved.add(cov + " transformer link(s) moved");

        // Location: a manual / GPS / verified position beats LORIOT's (or none).
        boolean sourceTrusted = source.getLatitude() != null && source.getLongitude() != null
                && (Boolean.TRUE.equals(source.getLocationVerified())
                || source.getLocationSource() == GatewayLocationSource.MANUAL || source.getLocationSource() == GatewayLocationSource.GPS);
        boolean targetTrusted = Boolean.TRUE.equals(target.getLocationVerified())
                || target.getLocationSource() == GatewayLocationSource.MANUAL || target.getLocationSource() == GatewayLocationSource.GPS;
        if (source.getLatitude() != null && source.getLongitude() != null
                && (target.getLatitude() == null || target.getLongitude() == null || (sourceTrusted && !targetTrusted))) {
            target.setLatitude(source.getLatitude());
            target.setLongitude(source.getLongitude());
            target.setAltitude(source.getAltitude());
            target.setLocationSource(source.getLocationSource() != null ? source.getLocationSource() : GatewayLocationSource.MANUAL);
            target.setLocationVerified(source.getLocationVerified());
            target.setLocationVerifiedAt(source.getLocationVerifiedAt());
            target.setLocationVerifiedBy(source.getLocationVerifiedBy());
            moved.add("location copied");
        }
        // Assignment and descriptive fields the kept gateway does not have yet.
        if (blank(target.getAddress())) target.setAddress(source.getAddress());
        if (blank(target.getDescription())) target.setDescription(source.getDescription());
        if (blank(target.getCustomer())) target.setCustomer(source.getCustomer());
        if (blank(target.getOperator())) target.setOperator(source.getOperator());
        if (blank(target.getNetworkName())) target.setNetworkName(source.getNetworkName());
        if (target.getRegionId() == null && blank(target.getRegionName())) {
            target.setRegionId(source.getRegionId());
            target.setRegionName(source.getRegionName());
        }
        if (target.getDistrictId() == null && blank(target.getDistrictName())) {
            target.setDistrictId(source.getDistrictId());
            target.setDistrictName(source.getDistrictName());
        }
        if (target.getDepotId() == null && blank(target.getDepotName())) {
            target.setDepotId(source.getDepotId());
            target.setDepotName(source.getDepotName());
        }
        if (target.getSiteId() == null) target.setSiteId(source.getSiteId());
        if (target.getCommissioningDate() == null) target.setCommissioningDate(source.getCommissioningDate());
        if (blank(target.getSerialNumber())) target.setSerialNumber(source.getSerialNumber());
        if (blank(target.getImei())) target.setImei(source.getImei());
        target.setUpdatedBy(actor);
        gatewayRepository.save(target);

        String note = "Merged from \"" + source.getName() + "\" (EUI " + source.getGatewayEui() + ", MAC " + source.getMacAddress()
                + ", record #" + source.getId() + ")" + (moved.isEmpty() ? "" : ": " + String.join(", ", moved))
                + (blank(in.note()) ? "" : ". Note: " + in.note().trim());
        changeLog.recordDiff(target, before, GatewayChangeLogService.SRC_USER, actor, note);
        changeLog.record(target, "MERGE", GatewayChangeLogService.SRC_USER, actor, note);
        changeLog.record(source, "MERGED_INTO", GatewayChangeLogService.SRC_USER, actor,
                "Merged into \"" + target.getName() + "\" (EUI " + target.getGatewayEui() + ", record #" + target.getId() + ") and removed. "
                        + snapshotText(source));
        removeRecord(source);
        log.info("Gateway #{} merged into #{} by {}", sourceId, target.getId(), actor);

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("keptId", target.getId());
        res.put("removedId", sourceId);
        res.put("moved", moved);
        return res;
    }

    // ------------------------------------------------------------------ delete

    @Transactional
    public Map<String, Object> delete(long id, boolean force, DeleteRequest in) {
        forbidSupplier();
        Gateway g = load(id);
        if (inLoriot(g) && !force) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "\"" + g.getName()
                    + "\" is still registered in LORIOT, so the next sync would add it again. Delete it in LORIOT first, or decommission it here.");
        }
        String actor = scope.getCurrentUserEmail();
        int sims = 0;
        for (GatewaySimAssignment a : assignmentRepository.findAll()) {
            if (!Objects.equals(a.getGatewayId(), id) || !Boolean.TRUE.equals(a.getActive())) continue;
            a.setActive(false);
            a.setUnassignedAt(Instant.now());
            a.setUnassignedBy(actor);
            a.setReason("Gateway \"" + g.getName() + "\" deleted");
            assignmentRepository.save(a);
            simCardRepository.findById(a.getSimId()).ifPresent(sim -> {
                sim.setStatus(SimCardStatus.AVAILABLE);
                sim.setUpdatedBy(actor);
                simCardRepository.save(sim);
            });
            sims++;
        }
        jdbc.update("DELETE FROM gateway_transformer_coverage WHERE gateway_id = :g", Map.of("g", id));
        changeLog.record(g, "DELETE", GatewayChangeLogService.SRC_USER, actor,
                (in != null && !blank(in.reason()) ? "Reason: " + in.reason().trim() + ". " : "")
                        + (sims > 0 ? sims + " SIM card(s) released. " : "") + snapshotText(g));
        removeRecord(g);
        log.info("Gateway #{} ({}) deleted by {}", id, g.getName(), actor);
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("deletedId", id);
        res.put("simsReleased", sims);
        return res;
    }

    /** Removes the record and what only made sense for it (status history, learnt links of its EUI). */
    private void removeRecord(Gateway g) {
        jdbc.update("DELETE FROM gateway_status_history WHERE gateway_id = :g", Map.of("g", g.getId()));
        if (g.getNormalizedGatewayEui() != null) {
            try {
                jdbc.update("DELETE FROM controller_gateway_links WHERE gateway_eui = :e", Map.of("e", g.getNormalizedGatewayEui()));
            } catch (Exception ignored) {
                // links table not present
            }
        }
        gatewayRepository.delete(g);
    }

    // ------------------------------------------------------------------ helpers

    private Gateway load(long id) {
        Gateway g = gatewayRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Gateway not found"));
        Long depot = scope.getCurrentDepotId();
        if (depot != null && !depot.equals(g.getDepotId())) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Gateway not found");
        return g;
    }

    private String snapshotText(Gateway g) {
        StringBuilder sb = new StringBuilder("Record was: ");
        changeLog.snapshot(g).forEach((k, v) -> {
            if (v != null) sb.append(k).append('=').append(v).append("; ");
        });
        return sb.toString();
    }

    private void forbidSupplier() {
        if (scope.isSupplierScoped()) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Partners cannot change gateways");
    }

    private static Instant lastSeen(Gateway g) {
        Instant a = g.getLastTrafficSeenAt();
        Instant b = g.getLastLoriotSeenAt();
        if (a == null) return b;
        if (b == null) return a;
        return a.isAfter(b) ? a : b;
    }

    private static boolean eq(String a, String b) {
        return a != null && !a.isBlank() && a.equals(b);
    }

    private static boolean oneApart(String a, String b) {
        if (a == null || b == null || a.length() != b.length() || a.length() < 8) return false;
        int d = 0;
        for (int i = 0; i < a.length(); i++) if (a.charAt(i) != b.charAt(i) && ++d > 1) return false;
        return d == 1;
    }

    private static String norm(String s) {
        if (s == null) return null;
        String t = s.replaceAll("[^A-Za-z0-9]", "").toUpperCase(Locale.ROOT);
        return t.isEmpty() ? null : t;
    }

    private static String nameKey(String s) {
        if (s == null) return null;
        String t = s.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
        return t.length() < 3 ? null : t;
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    private static ResponseStatusException bad(String m) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, m);
    }
}
