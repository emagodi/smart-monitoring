package com.safalifter.transformerservice.reaction;

import com.safalifter.transformerservice.config.AccessScopeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * Loss Control duty roster: per depot, which ZESA group staff are on duty and receive (and must acknowledge) the
 * alerts of that depot, and on which channels. A region is managed by ticking the same people for all its depots.
 * When a depot has nobody on duty, alerts still reach the Response Desk; nobody is paged.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DutyService {

    private final NamedParameterJdbcTemplate jdbc;
    private final AccessScopeService scope;
    private final DirectoryClient directory;

    public record Entry(Long userId, Boolean onDuty, Boolean notifySms, Boolean notifyWhatsapp, Boolean notifyEmail, String shiftNote) {}

    public record Update(List<Long> depotIds, List<Entry> entries) {}

    /** Candidates for the roster of these depots (their staff, the region's staff and national staff) with their duty flags. */
    public Map<String, Object> roster(List<Long> depotIds, Long regionId) {
        require("duty.read", "duty.manage");
        List<Long> depots = allowedDepots(depotIds);
        if (depots.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a depot or a region");
        List<Map<String, Object>> people;
        try {
            people = directory.users(join(depots), regionId, true, null);
        } catch (Exception e) {
            log.warn("User directory unavailable: {}", e.getMessage());
            people = new ArrayList<>();
        }
        Map<Long, List<Map<String, Object>>> rowsByUser = new HashMap<>();
        jdbc.queryForList("SELECT * FROM duty_roster WHERE depot_id IN (:d)", Map.of("d", depots))
                .forEach(r -> rowsByUser.computeIfAbsent(((Number) r.get("user_id")).longValue(), k -> new ArrayList<>()).add(r));
        Map<Long, Map<String, Object>> byId = new LinkedHashMap<>();
        for (Map<String, Object> p : people) {
            if (p.get("id") == null) continue;
            byId.put(((Number) p.get("id")).longValue(), new LinkedHashMap<>(p));
        }
        // people on the roster who are no longer in the directory answer (moved / disabled) are still shown
        rowsByUser.forEach((uid, rows) -> byId.computeIfAbsent(uid, k -> {
            Map<String, Object> r = rows.get(0);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", uid);
            m.put("name", r.get("user_name"));
            m.put("email", r.get("user_email"));
            m.put("phone", r.get("phone"));
            m.put("whatsappNumber", r.get("whatsapp"));
            m.put("stale", true);
            return m;
        }));
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map.Entry<Long, Map<String, Object>> e : byId.entrySet()) {
            List<Map<String, Object>> rows = rowsByUser.getOrDefault(e.getKey(), List.of());
            Map<String, Object> m = e.getValue();
            long onFor = rows.stream().filter(r -> truthy(r.get("on_duty"))).count();
            m.put("onDutyDepots", rows.stream().filter(r -> truthy(r.get("on_duty"))).map(r -> ((Number) r.get("depot_id")).longValue()).toList());
            m.put("onDuty", onFor > 0 && onFor == depots.size() ? "ALL" : onFor > 0 ? "SOME" : "NONE");
            Map<String, Object> first = rows.isEmpty() ? null : rows.get(0);
            m.put("notifySms", first == null || truthy(first.get("notify_sms")));
            m.put("notifyWhatsapp", first == null || truthy(first.get("notify_whatsapp")));
            m.put("notifyEmail", first != null && truthy(first.get("notify_email")));
            m.put("shiftNote", first != null ? first.get("shift_note") : null);
            m.put("updatedBy", first != null ? first.get("updated_by") : null);
            Object upd = first != null ? first.get("updated_at") : null;
            m.put("updatedAt", upd instanceof Timestamp ts ? ts.toLocalDateTime().toString() : upd != null ? upd.toString() : null);
            out.add(m);
        }
        out.sort((a, b) -> {
            int c = Integer.compare(rank(b.get("onDuty")), rank(a.get("onDuty")));
            return c != 0 ? c : String.valueOf(a.get("name")).compareToIgnoreCase(String.valueOf(b.get("name")));
        });
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("depotIds", depots);
        res.put("people", out);
        res.put("onDutyCount", out.stream().filter(m -> !"NONE".equals(m.get("onDuty"))).count());
        return res;
    }

    @Transactional
    public Map<String, Object> update(Update in, Long regionId) {
        require("duty.manage");
        if (in == null || in.entries() == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nothing to save");
        List<Long> depots = allowedDepots(in.depotIds());
        if (depots.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a depot or a region");
        List<Long> ids = in.entries().stream().map(Entry::userId).filter(Objects::nonNull).distinct().toList();
        Map<Long, Map<String, Object>> people = new HashMap<>();
        if (!ids.isEmpty()) {
            try {
                directory.users(null, null, true, join(ids)).forEach(p -> people.put(((Number) p.get("id")).longValue(), p));
            } catch (Exception e) {
                log.warn("User directory unavailable while saving roster: {}", e.getMessage());
            }
        }
        Timestamp now = Timestamp.valueOf(LocalDateTime.now());
        String me = scope.getCurrentUserEmail();
        for (Entry e : in.entries()) {
            if (e.userId() == null) continue;
            Map<String, Object> p = people.get(e.userId());
            for (Long depot : depots) {
                MapSqlParameterSource ps = new MapSqlParameterSource()
                        .addValue("d", depot).addValue("u", e.userId())
                        .addValue("email", p != null ? p.get("email") : null)
                        .addValue("name", p != null ? p.get("name") : null)
                        .addValue("phone", p != null ? p.get("phone") : null)
                        .addValue("wa", p != null ? p.get("whatsappNumber") : null)
                        .addValue("on", Boolean.TRUE.equals(e.onDuty()))
                        .addValue("sms", !Boolean.FALSE.equals(e.notifySms()))
                        .addValue("w", !Boolean.FALSE.equals(e.notifyWhatsapp()))
                        .addValue("em", Boolean.TRUE.equals(e.notifyEmail()))
                        .addValue("note", e.shiftNote() == null ? null : e.shiftNote().trim().substring(0, Math.min(255, e.shiftNote().trim().length())))
                        .addValue("by", me).addValue("now", now);
                jdbc.update("""
                        INSERT INTO duty_roster (depot_id, user_id, user_email, user_name, phone, whatsapp, on_duty, notify_sms, notify_whatsapp,
                            notify_email, shift_note, updated_by, updated_at)
                        VALUES (:d, :u, :email, :name, :phone, :wa, :on, :sms, :w, :em, :note, :by, :now)
                        ON DUPLICATE KEY UPDATE user_email = COALESCE(:email, user_email), user_name = COALESCE(:name, user_name),
                            phone = COALESCE(:phone, phone), whatsapp = COALESCE(:wa, whatsapp), on_duty = :on, notify_sms = :sms,
                            notify_whatsapp = :w, notify_email = :em, shift_note = :note, updated_by = :by, updated_at = :now""", ps);
            }
        }
        log.info("Duty roster updated by {} for depots {} ({} people)", me, depots, in.entries().size());
        return roster(depots, regionId);
    }

    /** On-duty people for a depot, for paging (no permission check: used by the alert pipeline). */
    public List<Map<String, Object>> onDutyFor(Long depotId) {
        if (depotId == null) return List.of();
        try {
            return jdbc.queryForList("SELECT * FROM duty_roster WHERE depot_id = :d AND on_duty = 1", Map.of("d", depotId));
        } catch (Exception e) {
            return List.of();
        }
    }

    /** Whether the signed-in user is on duty (for the siren) and whether any roster exists for their scope. */
    public Map<String, Object> me() {
        String email = scope.getCurrentUserEmail();
        Map<String, Object> m = new LinkedHashMap<>();
        List<Long> on = email == null ? List.of() : jdbc.queryForList(
                "SELECT depot_id FROM duty_roster WHERE LOWER(user_email) = LOWER(:e) AND on_duty = 1", Map.of("e", email), Long.class);
        Long depot = scope.getCurrentDepotId();
        Long configured = depot != null
                ? jdbc.queryForObject("SELECT COUNT(*) FROM duty_roster WHERE depot_id = :d AND on_duty = 1", Map.of("d", depot), Long.class)
                : jdbc.queryForObject("SELECT COUNT(*) FROM duty_roster WHERE on_duty = 1", Map.of(), Long.class);
        m.put("onDuty", !on.isEmpty());
        m.put("depotIds", on);
        m.put("rosterConfigured", configured != null && configured > 0);
        return m;
    }

    /** Depots with somebody on duty, and how many (for the coverage overview). */
    public Map<Long, Long> coverage() {
        require("duty.read", "duty.manage");
        Map<Long, Long> m = new LinkedHashMap<>();
        MapSqlParameterSource p = new MapSqlParameterSource();
        String w = "";
        if (scope.getCurrentDepotId() != null) { w = " AND depot_id = :d"; p.addValue("d", scope.getCurrentDepotId()); }
        jdbc.query("SELECT depot_id, COUNT(*) FROM duty_roster WHERE on_duty = 1" + w + " GROUP BY depot_id", p,
                (org.springframework.jdbc.core.RowCallbackHandler) rs -> m.put(rs.getLong(1), rs.getLong(2)));
        return m;
    }

    private List<Long> allowedDepots(List<Long> requested) {
        List<Long> list = requested == null ? List.of() : requested.stream().filter(Objects::nonNull).distinct().toList();
        Long mine = scope.getCurrentDepotId();
        if (mine != null) {
            if (!list.isEmpty() && list.stream().anyMatch(d -> !d.equals(mine))) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only manage the roster of your own depot");
            }
            return List.of(mine);
        }
        if (scope.isSupplierScoped()) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Partners do not manage the Loss Control roster");
        return list;
    }

    private void require(String... anyOf) {
        for (String p : anyOf) if (scope.hasPermission(p)) return;
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have permission for the duty roster");
    }

    private static int rank(Object onDuty) {
        return "ALL".equals(onDuty) ? 2 : "SOME".equals(onDuty) ? 1 : 0;
    }

    static boolean truthy(Object v) {
        if (v instanceof Boolean b) return b;
        if (v instanceof Number n) return n.intValue() != 0;
        return v != null && "true".equalsIgnoreCase(v.toString());
    }

    private static String join(List<Long> ids) {
        return ids.stream().map(String::valueOf).collect(Collectors.joining(","));
    }
}
