package com.safalifter.transformerservice.lifecycle;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.safalifter.transformerservice.config.AccessScopeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Year;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Installation and commissioning of monitoring devices on transformers.
 *
 * <pre>
 * Green light:   installation request (Powertel) PENDING -> APPROVED | DECLINED (region / depot) | CANCELLED
 * Installation:  INSTALLED (Powertel records it) -> READY (partner: "ready for commissioning")
 *                -> SCHEDULED (ZESA group sets a tentative date) -> COMMISSIONED | FAILED (Loss Control decides)
 *                FAILED -> READY / SCHEDULED again -> next commissioning attempt (every attempt keeps its form)
 *                any open stage -> CANCELLED (device removed / installation voided)
 * </pre>
 * Every change is written to lifecycle_events (who, which organisation, from/to status, note, when).
 * Plain JDBC on purpose: these tables are created by SchemaUpgrader and are not validated by Hibernate.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class LifecycleService {

    public static final Set<String> INSTALL_STATUSES = Set.of("INSTALLED", "READY", "SCHEDULED", "COMMISSIONED", "FAILED", "CANCELLED");
    public static final Set<String> REQUEST_STATUSES = Set.of("PENDING", "APPROVED", "DECLINED", "CANCELLED");

    private final NamedParameterJdbcTemplate jdbc;
    private final AccessScopeService scope;
    private final ObjectMapper objectMapper;

    // ------------------------------------------------------------------ requests (green light)

    public record RequestItem(Long transformerId, String siteLabel) {}

    public record CreateRequest(String supplierCode, String supplierName, Long regionId, String regionName, Long depotId,
                                String depotName, LocalDate plannedDate, LocalDate plannedEndDate, String accessNote,
                                List<RequestItem> items) {}

    public record Decision(String note) {}

    @Transactional
    public Map<String, Object> createRequest(CreateRequest in) {
        require("installations.request");
        if (in == null || in.depotId() == null && in.regionId() == null) bad("Choose the region and depot that must give the green light");
        if (in.plannedDate() == null) bad("Choose the planned installation date");
        if (in.items() == null || in.items().isEmpty()) bad("Add at least one transformer or site");
        Long depot = scope.getCurrentDepotId();
        if (depot != null && in.depotId() != null && !depot.equals(in.depotId())) forbidden("You can only raise requests for your own depot");
        String supplier = scope.isSupplierScoped() ? scope.getCurrentSupplierCode() : trim(in.supplierCode());
        String supplierName = scope.isSupplierScoped() ? scope.getCurrentSupplierName() : trim(in.supplierName());
        LocalDateTime now = LocalDateTime.now();
        KeyHolder kh = new GeneratedKeyHolder();
        jdbc.update("""
                INSERT INTO installation_requests (supplier_code, supplier_name, region_id, region_name, depot_id, depot_name,
                    planned_date, planned_end_date, access_note, status, requested_by, requested_at, updated_at)
                VALUES (:sc, :sn, :rid, :rn, :did, :dn, :pd, :ped, :note, 'PENDING', :by, :now, :now)""",
                new MapSqlParameterSource()
                        .addValue("sc", supplier).addValue("sn", supplierName)
                        .addValue("rid", in.regionId()).addValue("rn", trim(in.regionName()))
                        .addValue("did", in.depotId()).addValue("dn", trim(in.depotName()))
                        .addValue("pd", Date.valueOf(in.plannedDate()))
                        .addValue("ped", in.plannedEndDate() != null ? Date.valueOf(in.plannedEndDate()) : null)
                        .addValue("note", cut(in.accessNote(), 2000))
                        .addValue("by", me()).addValue("now", Timestamp.valueOf(now)), kh, new String[]{"id"});
        long id = kh.getKey().longValue();
        String ref = "IR-" + Year.now().getValue() + "-" + String.format("%04d", id);
        jdbc.update("UPDATE installation_requests SET reference = :r WHERE id = :id", Map.of("r", ref, "id", id));
        for (RequestItem item : in.items()) {
            if (item == null || item.transformerId() == null && isBlank(item.siteLabel())) continue;
            jdbc.update("INSERT INTO installation_request_items (request_id, transformer_id, site_label) VALUES (:r, :t, :l)",
                    new MapSqlParameterSource().addValue("r", id).addValue("t", item.transformerId()).addValue("l", cut(item.siteLabel(), 255)));
        }
        event(null, id, null, null, "REQUEST_CREATED", null, "PENDING",
                ref + ": " + in.items().size() + " site(s) on " + in.plannedDate() + (isBlank(in.accessNote()) ? "" : ". " + in.accessNote()));
        notify(in.depotId(), null, "Installation request " + ref + " needs your green light",
                "Powertel plans to install transformer monitoring devices at " + in.items().size() + " site(s) in "
                        + nz(in.depotName(), "your depot") + " on " + in.plannedDate()
                        + ". Please approve or decline in the system (Installations > Requests).");
        return getRequest(id);
    }

    @Transactional
    public Map<String, Object> decideRequest(long id, boolean approve, Decision d) {
        require("installations.approve");
        Map<String, Object> r = loadRequestScoped(id);
        String from = (String) r.get("status");
        if (!"PENDING".equals(from) && !("APPROVED".equals(from) && !approve)) bad("This request is already " + from.toLowerCase(Locale.ROOT));
        if (!approve && (d == null || isBlank(d.note()))) bad("Say why the request is declined");
        String to = approve ? "APPROVED" : "DECLINED";
        jdbc.update("UPDATE installation_requests SET status = :s, decided_by = :by, decided_at = :now, decision_note = :n, updated_at = :now WHERE id = :id",
                new MapSqlParameterSource().addValue("s", to).addValue("by", me()).addValue("now", now())
                        .addValue("n", d != null ? cut(d.note(), 1000) : null).addValue("id", id));
        event(null, id, null, null, approve ? "REQUEST_APPROVED" : "REQUEST_DECLINED", from, to, d != null ? d.note() : null);
        notify(null, (String) r.get("supplierCode"), "Installation request " + r.get("reference") + " " + to.toLowerCase(Locale.ROOT),
                "The green light for " + r.get("reference") + " (" + nz((String) r.get("depotName"), "depot") + ", " + r.get("plannedDate") + ") was "
                        + to.toLowerCase(Locale.ROOT) + (d != null && !isBlank(d.note()) ? ": " + d.note() : "."));
        return getRequest(id);
    }

    @Transactional
    public Map<String, Object> cancelRequest(long id, Decision d) {
        require("installations.request");
        Map<String, Object> r = loadRequestScoped(id);
        String from = (String) r.get("status");
        if ("CANCELLED".equals(from) || "DECLINED".equals(from)) bad("This request is already closed");
        jdbc.update("UPDATE installation_requests SET status = 'CANCELLED', updated_at = :now WHERE id = :id", Map.of("now", now(), "id", id));
        event(null, id, null, null, "REQUEST_CANCELLED", from, "CANCELLED", d != null ? d.note() : null);
        return getRequest(id);
    }

    public Map<String, Object> listRequests(String status, String supplier, List<Long> depotIds, LocalDate from, LocalDate to, String q, int page, int size) {
        require("installations.read");
        List<String> where = new ArrayList<>();
        MapSqlParameterSource p = new MapSqlParameterSource();
        scopeRequests(where, p);
        if (!isBlank(status)) { where.add("r.status = :st"); p.addValue("st", status.toUpperCase(Locale.ROOT)); }
        if (!isBlank(supplier) && !scope.isSupplierScoped()) { where.add("LOWER(r.supplier_code) = LOWER(:sup)"); p.addValue("sup", supplier); }
        if (depotIds != null && !depotIds.isEmpty()) { where.add("r.depot_id IN (:dids)"); p.addValue("dids", depotIds); }
        if (from != null) { where.add("r.planned_date >= :from"); p.addValue("from", Date.valueOf(from)); }
        if (to != null) { where.add("r.planned_date <= :to"); p.addValue("to", Date.valueOf(to)); }
        if (!isBlank(q)) {
            where.add("(r.reference LIKE :q OR r.depot_name LIKE :q OR r.supplier_name LIKE :q OR EXISTS (SELECT 1 FROM installation_request_items qi "
                    + "LEFT JOIN transformers qt ON qt.id = qi.transformer_id WHERE qi.request_id = r.id AND (qi.site_label LIKE :q OR qt.name LIKE :q OR qt.transformer_number LIKE :q)))");
            p.addValue("q", "%" + q.trim() + "%");
        }
        String w = where.isEmpty() ? "" : " WHERE " + String.join(" AND ", where);
        Long total = jdbc.queryForObject("SELECT COUNT(*) FROM installation_requests r" + w, p, Long.class);
        p.addValue("lim", clamp(size, 1, 5000)).addValue("off", Math.max(0, page) * (long) clamp(size, 1, 5000));
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT r.*,
                       (SELECT COUNT(*) FROM installation_request_items i WHERE i.request_id = r.id) AS item_count,
                       (SELECT COUNT(*) FROM transformer_installations ti WHERE ti.request_id = r.id AND ti.status <> 'CANCELLED') AS installed_count
                  FROM installation_requests r""" + w + " ORDER BY r.planned_date DESC, r.id DESC LIMIT :lim OFFSET :off", p);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("content", rows.stream().map(LifecycleService::camel).toList());
        out.put("totalElements", total == null ? 0 : total);
        out.put("counts", countBy("installation_requests r", "r.status", where, p));
        return out;
    }

    public Map<String, Object> getRequest(long id) {
        require("installations.read");
        Map<String, Object> r = loadRequestScoped(id);
        r.put("items", jdbc.queryForList("""
                SELECT i.id, i.transformer_id, i.site_label, t.name AS transformer_name, t.transformer_number, t.depot_id,
                       ti.id AS installation_id, ti.status AS installation_status, ti.installed_on
                  FROM installation_request_items i
                  LEFT JOIN transformers t ON t.id = i.transformer_id
                  LEFT JOIN transformer_installations ti ON ti.transformer_id = i.transformer_id AND ti.is_current = 1 AND ti.status <> 'CANCELLED'
                 WHERE i.request_id = :id ORDER BY i.id""", Map.of("id", id)).stream().map(LifecycleService::camel).toList());
        r.put("events", events("request_id", id));
        return r;
    }

    private Map<String, Object> loadRequestScoped(long id) {
        List<String> where = new ArrayList<>(List.of("r.id = :id"));
        MapSqlParameterSource p = new MapSqlParameterSource("id", id);
        scopeRequests(where, p);
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT r.* FROM installation_requests r WHERE " + String.join(" AND ", where), p);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Installation request not found");
        return camel(rows.get(0));
    }

    private void scopeRequests(List<String> where, MapSqlParameterSource p) {
        if (scope.isSupplierScoped()) { where.add("LOWER(r.supplier_code) = LOWER(:scopeSup)"); p.addValue("scopeSup", scope.getCurrentSupplierCode()); }
        if (scope.getCurrentDepotId() != null) { where.add("r.depot_id = :scopeDepot"); p.addValue("scopeDepot", scope.getCurrentDepotId()); }
    }

    // ------------------------------------------------------------------ installations

    public record RecordInstallation(List<Long> transformerIds, Long requestId, LocalDate installedOn, String supplierCode,
                                     String supplierName, String deviceEui, String note) {}

    public record StatusNote(String note) {}

    public record Schedule(LocalDate tentativeDate, String note) {}

    @Transactional
    public List<Map<String, Object>> recordInstallations(RecordInstallation in) {
        require("installations.record");
        if (in == null || in.transformerIds() == null || in.transformerIds().isEmpty()) bad("Choose the transformer(s) that were installed");
        LocalDate on = in.installedOn() != null ? in.installedOn() : LocalDate.now();
        if (on.isAfter(LocalDate.now().plusDays(1))) bad("The installation date cannot be in the future");
        String supplier = scope.isSupplierScoped() ? scope.getCurrentSupplierCode() : trim(in.supplierCode());
        String supplierName = scope.isSupplierScoped() ? scope.getCurrentSupplierName() : trim(in.supplierName());
        if (in.requestId() != null) {
            Map<String, Object> r = loadRequestScoped(in.requestId());
            if (!"APPROVED".equals(r.get("status"))) bad("Request " + r.get("reference") + " has not been approved (green light) yet");
            if (supplier == null) { supplier = (String) r.get("supplierCode"); supplierName = (String) r.get("supplierName"); }
        }
        if (isBlank(supplier)) bad("Choose the partner (contractor) that installed the device");
        List<Map<String, Object>> out = new ArrayList<>();
        for (Long tid : in.transformerIds().stream().filter(Objects::nonNull).distinct().toList()) {
            Map<String, Object> t = transformerScoped(tid);
            Long existing = jdbc.query("SELECT id FROM transformer_installations WHERE transformer_id = :t AND is_current = 1 AND status <> 'CANCELLED' LIMIT 1",
                    Map.of("t", tid), rs -> rs.next() ? rs.getLong(1) : null);
            if (existing != null) bad(t.get("name") + " already has an installation on record (#" + existing + "). Cancel it first to record a new one.");
            jdbc.update("UPDATE transformer_installations SET is_current = 0 WHERE transformer_id = :t", Map.of("t", tid));
            KeyHolder kh = new GeneratedKeyHolder();
            jdbc.update("""
                    INSERT INTO transformer_installations (transformer_id, request_id, supplier_code, supplier_name, depot_id, status,
                        installed_on, installed_by, device_eui, install_note, attempts, is_current, created_at, updated_at)
                    VALUES (:t, :r, :sc, :sn, :d, 'INSTALLED', :on, :by, :eui, :note, 0, 1, :now, :now)""",
                    new MapSqlParameterSource().addValue("t", tid).addValue("r", in.requestId()).addValue("sc", supplier)
                            .addValue("sn", supplierName).addValue("d", t.get("depot_id")).addValue("on", Date.valueOf(on))
                            .addValue("by", me()).addValue("eui", cut(in.deviceEui(), 64)).addValue("note", cut(in.note(), 1000))
                            .addValue("now", now()), kh, new String[]{"id"});
            long id = kh.getKey().longValue();
            event(id, in.requestId(), tid, null, "INSTALLED", null, "INSTALLED",
                    "Installed on " + on + " by " + nz(supplierName, supplier) + (isBlank(in.note()) ? "" : ". " + in.note()));
            out.add(getInstallation(id));
        }
        return out;
    }

    /** Partner: "this site is ready for commissioning" (after testing their own setup). */
    @Transactional
    public Map<String, Object> markReady(long id, StatusNote in) {
        require("installations.ready");
        Map<String, Object> i = loadInstallationScoped(id);
        if (!scope.isSupplierScoped() && !scope.hasPermission("installations.record")) forbidden("Only the partner marks a site ready");
        String from = (String) i.get("status");
        if (!Set.of("INSTALLED", "FAILED").contains(from)) bad("Only installed or failed sites can be marked ready (now " + from + ")");
        jdbc.update("UPDATE transformer_installations SET status = 'READY', ready_at = :now, ready_by = :by, ready_note = :n, updated_at = :now WHERE id = :id",
                new MapSqlParameterSource().addValue("now", now()).addValue("by", me()).addValue("n", cut(in != null ? in.note() : null, 1000)).addValue("id", id));
        event(id, null, (Long) i.get("transformerId"), null, "READY_FOR_COMMISSIONING", from, "READY", in != null ? in.note() : null);
        notify(depotOf(i), null, "Ready for commissioning: " + i.get("transformerName"),
                nz((String) i.get("supplierName"), "The partner") + " says " + i.get("transformerName")
                        + " is ready for commissioning. Please agree a tentative commissioning date in the system.");
        return getInstallation(id);
    }

    /** ZESA group (Powertel or Loss Control): agree a tentative commissioning date. */
    @Transactional
    public Map<String, Object> schedule(long id, Schedule in) {
        require("commissioning.schedule");
        internalOnly();
        if (in == null || in.tentativeDate() == null) bad("Choose the tentative commissioning date");
        Map<String, Object> i = loadInstallationScoped(id);
        String from = (String) i.get("status");
        if (!Set.of("READY", "SCHEDULED", "FAILED").contains(from)) bad("The partner has not marked this site ready yet (now " + from + ")");
        jdbc.update("UPDATE transformer_installations SET status = 'SCHEDULED', tentative_date = :d, scheduled_by = :by, scheduled_at = :now, schedule_note = :n, updated_at = :now WHERE id = :id",
                new MapSqlParameterSource().addValue("d", Date.valueOf(in.tentativeDate())).addValue("by", me()).addValue("now", now())
                        .addValue("n", cut(in.note(), 1000)).addValue("id", id));
        event(id, null, (Long) i.get("transformerId"), null, "SCHEDULED".equals(from) ? "RESCHEDULED" : "SCHEDULED", from, "SCHEDULED",
                "Tentative commissioning date " + in.tentativeDate() + (isBlank(in.note()) ? "" : ". " + in.note()));
        notify(depotOf(i), (String) i.get("supplierCode"), "Commissioning date set: " + i.get("transformerName"),
                "Tentative commissioning of " + i.get("transformerName") + " is on " + in.tentativeDate() + ".");
        return getInstallation(id);
    }

    @Transactional
    public Map<String, Object> cancelInstallation(long id, StatusNote in) {
        require("installations.record");
        internalOnly();
        if (in == null || isBlank(in.note())) bad("Say why the installation is cancelled");
        Map<String, Object> i = loadInstallationScoped(id);
        String from = (String) i.get("status");
        if ("CANCELLED".equals(from)) bad("Already cancelled");
        jdbc.update("UPDATE transformer_installations SET status = 'CANCELLED', updated_at = :now WHERE id = :id", Map.of("now", now(), "id", id));
        event(id, null, (Long) i.get("transformerId"), null, "CANCELLED", from, "CANCELLED", in.note());
        return getInstallation(id);
    }

    public Map<String, Object> listInstallations(String status, String supplier, List<Long> depotIds, LocalDate from, LocalDate to,
                                                 String dateField, Long requestId, String q, int page, int size) {
        require("installations.read");
        List<String> where = new ArrayList<>(List.of("ti.is_current = 1"));
        MapSqlParameterSource p = new MapSqlParameterSource();
        scopeInstallations(where, p);
        if (!isBlank(supplier) && !scope.isSupplierScoped()) { where.add("LOWER(ti.supplier_code) = LOWER(:sup)"); p.addValue("sup", supplier); }
        if (depotIds != null && !depotIds.isEmpty()) { where.add("ti.depot_id IN (:dids)"); p.addValue("dids", depotIds); }
        String col = switch (nz(dateField, "installed")) {
            case "ready" -> "DATE(ti.ready_at)";
            case "tentative" -> "ti.tentative_date";
            case "commissioned" -> "DATE(ti.commissioned_at)";
            default -> "ti.installed_on";
        };
        if (from != null) { where.add(col + " >= :from"); p.addValue("from", Date.valueOf(from)); }
        if (to != null) { where.add(col + " <= :to"); p.addValue("to", Date.valueOf(to)); }
        if (requestId != null) { where.add("ti.request_id = :rid"); p.addValue("rid", requestId); }
        if (!isBlank(q)) {
            where.add("(t.name LIKE :q OR t.transformer_number LIKE :q OR ti.device_eui LIKE :q OR ti.supplier_name LIKE :q)");
            p.addValue("q", "%" + q.trim() + "%");
        }
        List<String> withStatus = new ArrayList<>(where);
        if (!isBlank(status)) {
            List<String> st = Arrays.stream(status.split(",")).map(s -> s.trim().toUpperCase(Locale.ROOT)).filter(INSTALL_STATUSES::contains).toList();
            if (!st.isEmpty()) { withStatus.add("ti.status IN (:st)"); p.addValue("st", st); }
        }
        String base = " FROM transformer_installations ti JOIN transformers t ON t.id = ti.transformer_id LEFT JOIN installation_requests r ON r.id = ti.request_id";
        String w = " WHERE " + String.join(" AND ", withStatus);
        Long total = jdbc.queryForObject("SELECT COUNT(*)" + base + w, p, Long.class);
        int lim = clamp(size, 1, 5000);
        p.addValue("lim", lim).addValue("off", Math.max(0, page) * (long) lim);
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT " + INSTALL_COLS + base + w
                + " ORDER BY FIELD(ti.status,'READY','FAILED','SCHEDULED','INSTALLED','COMMISSIONED','CANCELLED'), ti.updated_at DESC LIMIT :lim OFFSET :off", p);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("content", rows.stream().map(LifecycleService::camel).toList());
        out.put("totalElements", total == null ? 0 : total);
        Map<String, Long> counts = new LinkedHashMap<>();
        jdbc.query("SELECT ti.status, COUNT(*) n" + base + " WHERE " + String.join(" AND ", where) + " GROUP BY ti.status", p,
                (org.springframework.jdbc.core.RowCallbackHandler) rs -> counts.put(rs.getString(1), rs.getLong(2)));
        out.put("counts", counts);
        return out;
    }

    private static final String INSTALL_COLS = """
             ti.id, ti.transformer_id, ti.request_id, ti.supplier_code, ti.supplier_name, ti.depot_id, ti.status, ti.installed_on,
             ti.installed_by, ti.device_eui, ti.install_note, ti.ready_at, ti.ready_by, ti.ready_note, ti.tentative_date, ti.scheduled_by,
             ti.scheduled_at, ti.schedule_note, ti.commissioned_at, ti.failed_at, ti.attempts, ti.created_at, ti.updated_at,
             t.name AS transformer_name, t.transformer_number, t.lat, t.lng, r.reference AS request_reference,
             (SELECT ca.status FROM commissioning_attempts ca WHERE ca.installation_id = ti.id ORDER BY ca.attempt_no DESC LIMIT 1) AS last_attempt_status,
             (SELECT ca.id FROM commissioning_attempts ca WHERE ca.installation_id = ti.id AND ca.status = 'DRAFT' ORDER BY ca.id DESC LIMIT 1) AS open_draft_id
            """;

    public Map<String, Object> getInstallation(long id) {
        require("installations.read");
        Map<String, Object> i = loadInstallationScoped(id);
        i.put("attemptHistory", jdbc.queryForList("""
                SELECT id, attempt_no, status, test_date, decided_by, decided_at, decision_note, created_by, created_at, updated_at
                  FROM commissioning_attempts WHERE installation_id = :id ORDER BY attempt_no""", Map.of("id", id))
                .stream().map(LifecycleService::camel).toList());
        i.put("events", events("installation_id", id));
        return i;
    }

    /** Full history of a transformer (all installations, attempts and events), for the transformer page. */
    public Map<String, Object> transformerHistory(long transformerId) {
        require("installations.read");
        transformerScoped(transformerId);
        List<String> where = new ArrayList<>(List.of("ti.transformer_id = :t"));
        MapSqlParameterSource p = new MapSqlParameterSource("t", transformerId);
        scopeInstallations(where, p);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("installations", jdbc.queryForList("SELECT " + INSTALL_COLS
                        + " FROM transformer_installations ti JOIN transformers t ON t.id = ti.transformer_id LEFT JOIN installation_requests r ON r.id = ti.request_id WHERE "
                        + String.join(" AND ", where) + " ORDER BY ti.id DESC", p)
                .stream().map(LifecycleService::camel).toList());
        out.put("events", events("transformer_id", transformerId));
        return out;
    }

    private Map<String, Object> loadInstallationScoped(long id) {
        List<String> where = new ArrayList<>(List.of("ti.id = :id"));
        MapSqlParameterSource p = new MapSqlParameterSource("id", id);
        scopeInstallations(where, p);
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT " + INSTALL_COLS
                + " FROM transformer_installations ti JOIN transformers t ON t.id = ti.transformer_id LEFT JOIN installation_requests r ON r.id = ti.request_id WHERE "
                + String.join(" AND ", where), p);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Installation not found");
        return camel(rows.get(0));
    }

    /** Partners see only the installations they did; depot users only their depot's. */
    private void scopeInstallations(List<String> where, MapSqlParameterSource p) {
        if (scope.isSupplierScoped()) { where.add("LOWER(ti.supplier_code) = LOWER(:scopeSup)"); p.addValue("scopeSup", scope.getCurrentSupplierCode()); }
        if (scope.getCurrentDepotId() != null) { where.add("ti.depot_id = :scopeDepot"); p.addValue("scopeDepot", scope.getCurrentDepotId()); }
    }

    private Map<String, Object> transformerScoped(long id) {
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT id, name, transformer_number, depot_id, supplier_code FROM transformers WHERE id = :id", Map.of("id", id));
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Transformer " + id + " not found");
        Map<String, Object> t = rows.get(0);
        Long depot = scope.getCurrentDepotId();
        if (depot != null && t.get("depot_id") != null && !depot.equals(((Number) t.get("depot_id")).longValue())) forbidden("That transformer is not in your depot");
        return t;
    }

    // ------------------------------------------------------------------ commissioning (PAT form)

    /** The 14 checks on the Preliminary Acceptance Test (PAT) report for the Transformer Anti-Intrusion System. */
    public static final List<Map<String, String>> PAT_ITEMS = List.of(
            item("motion", "Motion detection", "Motion intrusion simulation"),
            item("door_vibration", "Door open/close or vibration detection", "Door opening or transformer vibration simulation"),
            item("buzzer_flash", "On site buzzer and flashlights", "Buzzer & flash lights should be illustrated"),
            item("panel_ip65", "Water-resistant control panel (rated IP 65)", "Water-resistant control panel must be presented installed on site"),
            item("sensitivity", "Adjustable motion sensitivity", "Demonstrate sensor detection at adjustable ranges"),
            item("coverage_360", "360 degrees detection", "Demonstrate that the system does not have any blind spots"),
            item("safe_height", "Gadget installed at safe height or safe location in GMT", "The gadgets must be installed at a safe position"),
            item("ac_input", "220-240V AC transformer input correctly tapped with lugs", "System must be able to function on transformer auxiliary 220-240V"),
            item("cabling", "Cabling", "Proper structured cabling in and outside control panel"),
            item("sms_5", "SMS notification >= 5 numbers", ">= 5 SMS number demonstrations when intrusion is detected"),
            item("voice_3", "Voice calling >= 3 numbers", ">= 3 voice number demonstrations when intrusion is detected"),
            item("offsite_arm", "Offsite arming and disarming", "Platform or SMS arming/disarming"),
            item("platform", "Platform integration", "Alarms can be viewed via the web platform"),
            item("auto_arm", "Automatic arm/disarming", "Automatic arm/disarming to be demonstrated"));

    /** Who signs the form. ZETDC and ZESA Loss Control are ZESA group users; Contractor = the partner. */
    public static final List<Map<String, String>> SIGNATORIES = List.of(
            Map.of("role", "ZETDC", "label", "ZETDC"),
            Map.of("role", "ZESA_LOSS_CONTROL", "label", "ZESA Loss Control"),
            Map.of("role", "POWERTEL", "label", "Powertel"),
            Map.of("role", "CONTRACTOR", "label", "Contractor"));

    private static Map<String, String> item(String key, String requirement, String criteria) {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("key", key);
        m.put("requirement", requirement);
        m.put("criteria", criteria);
        return m;
    }

    public record AttemptItem(String key, String result, String remark) {}

    public record Signature(String role, String name, String image, String signedAt) {}

    public record AttemptForm(LocalDate testDate, String depotLabel, String locationLabel, String ssNumber, List<AttemptItem> items,
                              String comments, List<Signature> signatures) {}

    public record Finalise(String result, String note) {}

    public Map<String, Object> template() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("items", PAT_ITEMS);
        m.put("signatories", SIGNATORIES);
        return m;
    }

    /** Opens the next commissioning attempt (or returns the open draft). */
    @Transactional
    public Map<String, Object> openAttempt(long installationId) {
        require("commissioning.perform");
        internalOnly();
        Map<String, Object> i = loadInstallationScoped(installationId);
        String st = (String) i.get("status");
        if (!Set.of("READY", "SCHEDULED", "FAILED").contains(st)) bad("Commissioning can start once the partner marks the site ready (now " + st + ")");
        Long draft = jdbc.query("SELECT id FROM commissioning_attempts WHERE installation_id = :i AND status = 'DRAFT' ORDER BY id DESC LIMIT 1",
                Map.of("i", installationId), rs -> rs.next() ? rs.getLong(1) : null);
        if (draft != null) return getAttempt(draft);
        Integer n = jdbc.queryForObject("SELECT COALESCE(MAX(attempt_no), 0) FROM commissioning_attempts WHERE installation_id = :i", Map.of("i", installationId), Integer.class);
        int attemptNo = (n == null ? 0 : n) + 1;
        List<Map<String, Object>> items = PAT_ITEMS.stream().map(x -> {
            Map<String, Object> m = new LinkedHashMap<>(x);
            m.put("result", null);
            m.put("remark", null);
            return m;
        }).collect(Collectors.toList());
        KeyHolder kh = new GeneratedKeyHolder();
        jdbc.update("""
                INSERT INTO commissioning_attempts (installation_id, transformer_id, attempt_no, status, test_date, location_label, items,
                    created_by, created_at, updated_by, updated_at)
                VALUES (:i, :t, :n, 'DRAFT', :d, :loc, :items, :by, :now, :by, :now)""",
                new MapSqlParameterSource().addValue("i", installationId).addValue("t", i.get("transformerId")).addValue("n", attemptNo)
                        .addValue("d", Date.valueOf(LocalDate.now())).addValue("loc", cut((String) i.get("transformerName"), 255))
                        .addValue("items", json(items)).addValue("by", me()).addValue("now", now()), kh, new String[]{"id"});
        long id = kh.getKey().longValue();
        jdbc.update("UPDATE transformer_installations SET attempts = :n, updated_at = :now WHERE id = :i", Map.of("n", attemptNo, "now", now(), "i", installationId));
        event(installationId, null, (Long) i.get("transformerId"), id, "COMMISSIONING_STARTED", st, st, "Attempt " + attemptNo + " opened");
        return getAttempt(id);
    }

    @Transactional
    public Map<String, Object> saveAttempt(long attemptId, AttemptForm f) {
        require("commissioning.perform");
        internalOnly();
        Map<String, Object> a = getAttempt(attemptId);
        if (!"DRAFT".equals(a.get("status"))) bad("This attempt is final and cannot be changed. Open a new attempt instead.");
        Map<String, String> allowed = PAT_ITEMS.stream().collect(Collectors.toMap(x -> x.get("key"), x -> x.get("requirement"), (x, y) -> x, LinkedHashMap::new));
        List<Map<String, Object>> items = new ArrayList<>();
        Map<String, AttemptItem> given = f.items() == null ? Map.of() : f.items().stream().filter(x -> x != null && x.key() != null)
                .collect(Collectors.toMap(AttemptItem::key, x -> x, (x, y) -> y));
        for (Map<String, String> def : PAT_ITEMS) {
            AttemptItem g = given.get(def.get("key"));
            Map<String, Object> m = new LinkedHashMap<>(def);
            String res = g != null && g.result() != null ? g.result().trim().toUpperCase(Locale.ROOT) : null;
            m.put("result", res != null && Set.of("YES", "NO", "NA").contains(res) ? res : null);
            m.put("remark", g != null ? cut(g.remark(), 500) : null);
            items.add(m);
        }
        List<Map<String, Object>> sigs = new ArrayList<>();
        if (f.signatures() != null) {
            for (Signature s : f.signatures()) {
                if (s == null || s.role() == null) continue;
                if (s.image() != null && (s.image().length() > 400_000 || !s.image().startsWith("data:image/"))) bad("Signature image is not valid");
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("role", s.role());
                m.put("name", cut(s.name(), 120));
                m.put("image", s.image());
                m.put("signedAt", s.signedAt());
                m.put("capturedBy", me());
                sigs.add(m);
            }
        }
        jdbc.update("""
                UPDATE commissioning_attempts SET test_date = :d, depot_label = :dl, location_label = :ll, ss_number = :ss, items = :items,
                    comments = :c, signatures = :sig, updated_by = :by, updated_at = :now WHERE id = :id""",
                new MapSqlParameterSource().addValue("d", f.testDate() != null ? Date.valueOf(f.testDate()) : null)
                        .addValue("dl", cut(f.depotLabel(), 255)).addValue("ll", cut(f.locationLabel(), 255)).addValue("ss", cut(f.ssNumber(), 64))
                        .addValue("items", json(items)).addValue("c", cut(f.comments(), 8000)).addValue("sig", json(sigs))
                        .addValue("by", me()).addValue("now", now()).addValue("id", attemptId));
        long instId = ((Number) a.get("installationId")).longValue();
        event(instId, null, (Long) a.get("transformerId"), attemptId, "COMMISSIONING_SAVED", null, null,
                "Attempt " + a.get("attemptNo") + " form saved (" + items.stream().filter(x -> x.get("result") != null).count() + "/" + items.size() + " checks, "
                        + sigs.stream().filter(x -> x.get("image") != null).count() + " signature(s))");
        return getAttempt(attemptId);
    }

    /** Loss Control has the final say: PASSED -> transformer commissioned, FAILED -> partner fixes and a new attempt follows. */
    @Transactional
    public Map<String, Object> finaliseAttempt(long attemptId, Finalise in) {
        require("commissioning.decide");
        internalOnly();
        String result = in != null && in.result() != null ? in.result().trim().toUpperCase(Locale.ROOT) : "";
        if (!Set.of("PASSED", "FAILED").contains(result)) bad("Choose Commissioned (passed) or Failed");
        Map<String, Object> a = getAttempt(attemptId);
        if (!"DRAFT".equals(a.get("status"))) bad("This attempt is already " + a.get("status"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) a.get("items");
        long unanswered = items.stream().filter(x -> x.get("result") == null).count();
        if (unanswered > 0) bad(unanswered + " check(s) have no answer. Mark each check Yes, No or N/A.");
        if ("PASSED".equals(result) && items.stream().anyMatch(x -> "NO".equals(x.get("result"))))
            bad("A check is marked No. All applicable checks must pass for the solution to be accepted.");
        if ("FAILED".equals(result) && (in.note() == null || in.note().isBlank()) && items.stream().noneMatch(x -> "NO".equals(x.get("result"))))
            bad("Say why commissioning failed");
        long instId = ((Number) a.get("installationId")).longValue();
        Map<String, Object> i = loadInstallationScoped(instId);
        String to = "PASSED".equals(result) ? "COMMISSIONED" : "FAILED";
        jdbc.update("UPDATE commissioning_attempts SET status = :s, decided_by = :by, decided_at = :now, decision_note = :n, updated_at = :now WHERE id = :id",
                new MapSqlParameterSource().addValue("s", result).addValue("by", me()).addValue("now", now()).addValue("n", cut(in.note(), 1000)).addValue("id", attemptId));
        jdbc.update("UPDATE transformer_installations SET status = :s, " + ("COMMISSIONED".equals(to) ? "commissioned_at" : "failed_at") + " = :now, updated_at = :now WHERE id = :id",
                Map.of("s", to, "now", now(), "id", instId));
        event(instId, null, (Long) i.get("transformerId"), attemptId, "PASSED".equals(result) ? "COMMISSIONED" : "COMMISSIONING_FAILED",
                (String) i.get("status"), to, "Attempt " + a.get("attemptNo") + ": " + result.toLowerCase(Locale.ROOT) + (isBlank(in.note()) ? "" : ". " + in.note()));
        notify(depotOf(i), (String) i.get("supplierCode"),
                ("COMMISSIONED".equals(to) ? "Commissioned: " : "Commissioning failed: ") + i.get("transformerName"),
                "Attempt " + a.get("attemptNo") + " for " + i.get("transformerName") + " was " + ("COMMISSIONED".equals(to) ? "passed. The site is commissioned." : "failed"
                        + (isBlank(in.note()) ? "." : ": " + in.note()) + " Fix the issues and mark the site ready again for the next attempt."));
        return getAttempt(attemptId);
    }

    @Transactional
    public void deleteDraft(long attemptId) {
        require("commissioning.perform");
        internalOnly();
        Map<String, Object> a = getAttempt(attemptId);
        if (!"DRAFT".equals(a.get("status"))) bad("Only a draft can be discarded");
        long instId = ((Number) a.get("installationId")).longValue();
        jdbc.update("DELETE FROM commissioning_attempts WHERE id = :id", Map.of("id", attemptId));
        Integer n = jdbc.queryForObject("SELECT COALESCE(MAX(attempt_no), 0) FROM commissioning_attempts WHERE installation_id = :i", Map.of("i", instId), Integer.class);
        jdbc.update("UPDATE transformer_installations SET attempts = :n, updated_at = :now WHERE id = :i", Map.of("n", n == null ? 0 : n, "now", now(), "i", instId));
        event(instId, null, (Long) a.get("transformerId"), attemptId, "COMMISSIONING_DISCARDED", null, null, "Draft attempt " + a.get("attemptNo") + " discarded");
    }

    public Map<String, Object> getAttempt(long attemptId) {
        require("commissioning.read", "installations.read");
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT * FROM commissioning_attempts WHERE id = :id", Map.of("id", attemptId));
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Commissioning attempt not found");
        Map<String, Object> raw = rows.get(0);
        Map<String, Object> i = loadInstallationScoped(((Number) raw.get("installation_id")).longValue()); // scope check
        String itemsJson = (String) raw.remove("items");
        String sigJson = (String) raw.remove("signatures");
        Map<String, Object> a = camel(raw);
        a.put("items", readJsonList(itemsJson));
        a.put("signatures", readJsonList(sigJson));
        a.put("installation", i);
        return a;
    }

    public Map<String, Object> listAttempts(String result, String supplier, List<Long> depotIds, LocalDate from, LocalDate to, String q, int page, int size) {
        require("commissioning.read", "installations.read");
        List<String> where = new ArrayList<>();
        MapSqlParameterSource p = new MapSqlParameterSource();
        scopeInstallations(where, p);
        if (!isBlank(result)) { where.add("ca.status = :res"); p.addValue("res", result.toUpperCase(Locale.ROOT)); }
        if (!isBlank(supplier) && !scope.isSupplierScoped()) { where.add("LOWER(ti.supplier_code) = LOWER(:sup)"); p.addValue("sup", supplier); }
        if (depotIds != null && !depotIds.isEmpty()) { where.add("ti.depot_id IN (:dids)"); p.addValue("dids", depotIds); }
        if (from != null) { where.add("ca.test_date >= :from"); p.addValue("from", Date.valueOf(from)); }
        if (to != null) { where.add("ca.test_date <= :to"); p.addValue("to", Date.valueOf(to)); }
        if (!isBlank(q)) { where.add("(t.name LIKE :q OR t.transformer_number LIKE :q OR ca.ss_number LIKE :q)"); p.addValue("q", "%" + q.trim() + "%"); }
        String base = " FROM commissioning_attempts ca JOIN transformer_installations ti ON ti.id = ca.installation_id JOIN transformers t ON t.id = ti.transformer_id";
        String w = where.isEmpty() ? "" : " WHERE " + String.join(" AND ", where);
        Long total = jdbc.queryForObject("SELECT COUNT(*)" + base + w, p, Long.class);
        int lim = clamp(size, 1, 5000);
        p.addValue("lim", lim).addValue("off", Math.max(0, page) * (long) lim);
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT ca.id, ca.installation_id, ca.attempt_no, ca.status, ca.test_date, ca.ss_number, ca.decided_by, ca.decided_at, ca.decision_note,
                       ca.created_by, ca.created_at, ti.transformer_id, ti.supplier_code, ti.supplier_name, ti.depot_id, ti.installed_on, ti.ready_at,
                       ti.status AS installation_status, ti.attempts AS total_attempts, t.name AS transformer_name, t.transformer_number""" + base + w
                + " ORDER BY ca.test_date DESC, ca.id DESC LIMIT :lim OFFSET :off", p);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("content", rows.stream().map(LifecycleService::camel).toList());
        out.put("totalElements", total == null ? 0 : total);
        out.put("counts", countBy("commissioning_attempts ca JOIN transformer_installations ti ON ti.id = ca.installation_id JOIN transformers t ON t.id = ti.transformer_id",
                "ca.status", where, p));
        return out;
    }

    // ------------------------------------------------------------------ helpers

    private List<Map<String, Object>> events(String column, long id) {
        List<String> where = new ArrayList<>(List.of("e." + column + " = :id"));
        MapSqlParameterSource p = new MapSqlParameterSource("id", id);
        return jdbc.queryForList("SELECT e.* FROM lifecycle_events e WHERE " + String.join(" AND ", where) + " ORDER BY e.created_at DESC, e.id DESC LIMIT 500", p)
                .stream().map(LifecycleService::camel).toList();
    }

    private void event(Long installationId, Long requestId, Long transformerId, Long attemptId, String type, String from, String to, String note) {
        jdbc.update("""
                INSERT INTO lifecycle_events (installation_id, request_id, transformer_id, attempt_id, event_type, from_status, to_status,
                    actor_email, actor_org, note, created_at)
                VALUES (:i, :r, :t, :a, :type, :from, :to, :by, :org, :note, :now)""",
                new MapSqlParameterSource().addValue("i", installationId).addValue("r", requestId).addValue("t", transformerId)
                        .addValue("a", attemptId).addValue("type", type).addValue("from", from).addValue("to", to)
                        .addValue("by", me()).addValue("org", scope.isSupplierScoped() ? "PARTNER" : "ZESA")
                        .addValue("note", cut(note, 2000)).addValue("now", now()));
    }

    private Map<String, Long> countBy(String from, String col, List<String> where, MapSqlParameterSource p) {
        Map<String, Long> counts = new LinkedHashMap<>();
        jdbc.query("SELECT " + col + ", COUNT(*) FROM " + from + (where.isEmpty() ? "" : " WHERE " + String.join(" AND ", where)) + " GROUP BY " + col, p,
                (org.springframework.jdbc.core.RowCallbackHandler) rs -> counts.put(rs.getString(1), rs.getLong(2)));
        return counts;
    }

    /**
     * In-app only for now: lifecycle news reaches people through the notification bell (see bellItems), never as
     * bulk e-mail. Hook kept so e-mail / WhatsApp can be switched on per audience once routing per role exists.
     */
    private void notify(Long depotId, String supplierCode, String subject, String message) {
        log.debug("Lifecycle notice [{}|{}] {}: {}", depotId, supplierCode, subject, message);
    }

    /** Lifecycle items for the notification bell, tailored to what this user acts on. */
    public List<Map<String, Object>> bellItems() {
        if (!scope.hasPermission("installations.read")) return List.of();
        List<String> types = new ArrayList<>();
        boolean partner = scope.isSupplierScoped();
        if (partner) {
            types.addAll(List.of("REQUEST_APPROVED", "REQUEST_DECLINED", "SCHEDULED", "RESCHEDULED", "COMMISSIONED", "COMMISSIONING_FAILED"));
        } else {
            if (scope.hasPermission("installations.approve")) types.add("REQUEST_CREATED");
            if (scope.hasPermission("commissioning.schedule")) types.add("READY_FOR_COMMISSIONING");
            if (scope.hasPermission("commissioning.perform")) types.addAll(List.of("SCHEDULED", "RESCHEDULED"));
            if (scope.hasPermission("installations.request")) types.addAll(List.of("REQUEST_APPROVED", "REQUEST_DECLINED"));
            if (scope.hasPermission("commissioning.read")) types.addAll(List.of("COMMISSIONED", "COMMISSIONING_FAILED"));
        }
        if (types.isEmpty()) return List.of();
        MapSqlParameterSource p = new MapSqlParameterSource("types", types).addValue("since", Timestamp.valueOf(LocalDateTime.now().minusDays(7)));
        List<String> where = new ArrayList<>(List.of("e.event_type IN (:types)", "e.created_at >= :since"));
        if (partner) { where.add("LOWER(COALESCE(ti.supplier_code, r.supplier_code)) = LOWER(:scopeSup)"); p.addValue("scopeSup", scope.getCurrentSupplierCode()); }
        if (scope.getCurrentDepotId() != null) { where.add("COALESCE(ti.depot_id, r.depot_id) = :scopeDepot"); p.addValue("scopeDepot", scope.getCurrentDepotId()); }
        try {
            return jdbc.queryForList("""
                    SELECT e.id, e.event_type, e.note, e.created_at, e.installation_id, e.request_id, t.name AS transformer_name,
                           r.reference, r.status AS request_status
                      FROM lifecycle_events e
                      LEFT JOIN transformer_installations ti ON ti.id = e.installation_id
                      LEFT JOIN transformers t ON t.id = COALESCE(e.transformer_id, ti.transformer_id)
                      LEFT JOIN installation_requests r ON r.id = COALESCE(e.request_id, ti.request_id)
                     WHERE """ + " " + String.join(" AND ", where) + " ORDER BY e.created_at DESC LIMIT 10", p).stream().map(row -> {
                String type = (String) row.get("event_type");
                if ("REQUEST_CREATED".equals(type) && !"PENDING".equals(row.get("request_status"))) return null;
                String t = row.get("transformer_name") != null ? (String) row.get("transformer_name") : (String) row.get("reference");
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("id", "life-" + row.get("id"));
                m.put("kind", "LIFECYCLE");
                m.put("severity", switch (type) {
                    case "COMMISSIONED", "REQUEST_APPROVED" -> "success";
                    case "COMMISSIONING_FAILED", "REQUEST_DECLINED" -> "critical";
                    case "REQUEST_CREATED", "READY_FOR_COMMISSIONING" -> "warning";
                    default -> "info";
                });
                m.put("title", switch (type) {
                    case "REQUEST_CREATED" -> "Green light needed · " + t;
                    case "REQUEST_APPROVED" -> "Green light given · " + t;
                    case "REQUEST_DECLINED" -> "Green light declined · " + t;
                    case "READY_FOR_COMMISSIONING" -> "Ready for commissioning · " + t;
                    case "SCHEDULED", "RESCHEDULED" -> "Commissioning date set · " + t;
                    case "COMMISSIONED" -> "Commissioned · " + t;
                    default -> "Commissioning failed · " + t;
                });
                m.put("body", row.get("note") != null ? row.get("note") : "");
                Object at = row.get("created_at");
                m.put("at", at instanceof Timestamp ts ? ts.toLocalDateTime() : at instanceof LocalDateTime l ? l : LocalDateTime.now());
                m.put("link", row.get("installation_id") != null ? "/installations/" + row.get("installation_id") : "/installations?tab=requests");
                return m;
            }).filter(Objects::nonNull).toList();
        } catch (Exception e) {
            log.warn("Lifecycle bell items failed: {}", e.getMessage());
            return List.of();
        }
    }

    private static Long depotOf(Map<String, Object> i) {
        Object d = i.get("depotId");
        return d instanceof Number n ? n.longValue() : null;
    }

    private void require(String... anyOf) {
        for (String perm : anyOf) if (scope.hasPermission(perm)) return;
        forbidden("You do not have permission for this (" + String.join(" or ", anyOf) + ")");
    }

    private void internalOnly() {
        if (scope.isSupplierScoped()) forbidden("Only ZESA group users can do this");
    }

    private String me() {
        String e = scope.getCurrentUserEmail();
        return e == null ? "system" : e;
    }

    private static Timestamp now() {
        return Timestamp.valueOf(LocalDateTime.now());
    }

    private String json(Object o) {
        try {
            return objectMapper.writeValueAsString(o);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private List<Map<String, Object>> readJsonList(String s) {
        if (s == null || s.isBlank()) return new ArrayList<>();
        try {
            return objectMapper.readValue(s, new TypeReference<List<Map<String, Object>>>() {});
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    /** snake_case row -> camelCase map; dates as ISO strings, TINYINT/BIT flags as booleans. */
    public static Map<String, Object> camel(Map<String, Object> row) {
        Map<String, Object> out = new LinkedHashMap<>();
        row.forEach((k, v) -> {
            StringBuilder sb = new StringBuilder();
            boolean up = false;
            for (char ch : k.toLowerCase(Locale.ROOT).toCharArray()) {
                if (ch == '_') { up = true; continue; }
                sb.append(up ? Character.toUpperCase(ch) : ch);
                up = false;
            }
            Object val = v;
            if (v instanceof Timestamp ts) val = ts.toLocalDateTime().toString();
            else if (v instanceof Date d) val = d.toLocalDate().toString();
            else if (v instanceof java.time.LocalDateTime ldt) val = ldt.toString();
            else if (v instanceof java.time.LocalDate ld) val = ld.toString();
            else if (v instanceof java.math.BigInteger bi) val = bi.longValue();
            out.put(sb.toString(), val);
        });
        return out;
    }

    private static void bad(String msg) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, msg);
    }

    private static void forbidden(String msg) {
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, msg);
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private static String trim(String s) {
        return isBlank(s) ? null : s.trim();
    }

    private static String nz(String s, String d) {
        return isBlank(s) ? d : s;
    }

    private static String cut(String s, int max) {
        if (s == null) return null;
        String t = s.trim();
        if (t.isEmpty()) return null;
        return t.length() > max ? t.substring(0, max) : t;
    }

    private static int clamp(int v, int lo, int hi) {
        return Math.max(lo, Math.min(hi, v));
    }
}
