package com.safalifter.authservice.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Small, paged, searchable lookups for pickers (choose a region for a district, a district for a
 * depot). The browser asks for one page of matches as the user types instead of downloading
 * every region or district.
 */
@Tag(name = "Geography lookups")
@RestController
@RequiredArgsConstructor
public class GeoLookupController {

    private static final int MAX_SIZE = 50;

    private final JdbcTemplate jdbc;

    @GetMapping("/api/v1/regions/lookup")
    @Operation(summary = "Search regions by name, one page at a time")
    @PreAuthorize("hasAuthority('regions.read') or hasAuthority('districts.read') or hasAuthority('districts.create') or hasAuthority('districts.update') or hasRole('ADMIN') or hasRole('ADMINISTRATOR')")
    public ResponseEntity<Map<String, Object>> regions(@RequestParam(defaultValue = "") String q,
                                                       @RequestParam(defaultValue = "0") int page,
                                                       @RequestParam(defaultValue = "20") int size) {
        int n = Math.max(1, Math.min(size, MAX_SIZE));
        int offset = Math.max(0, page) * n;
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT r.id, r.name, (SELECT COUNT(*) FROM districts d WHERE d.region_id = r.id) AS children"
                        + " FROM regions r WHERE r.name LIKE ? ORDER BY r.name LIMIT ? OFFSET ?",
                like(q), n + 1, offset);
        return ResponseEntity.ok(page(rows, n, r -> item(r.get("id"), r.get("name"), null, null, r.get("children"))));
    }

    @GetMapping("/api/v1/districts/lookup")
    @Operation(summary = "Search districts by district or region name, one page at a time")
    @PreAuthorize("hasAuthority('districts.read') or hasAuthority('depots.read') or hasAuthority('depots.create') or hasAuthority('depots.update') or hasRole('ADMIN') or hasRole('ADMINISTRATOR')")
    public ResponseEntity<Map<String, Object>> districts(@RequestParam(defaultValue = "") String q,
                                                         @RequestParam(required = false) Long regionId,
                                                         @RequestParam(defaultValue = "0") int page,
                                                         @RequestParam(defaultValue = "20") int size) {
        int n = Math.max(1, Math.min(size, MAX_SIZE));
        int offset = Math.max(0, page) * n;
        String like = like(q);
        List<Object> args = new ArrayList<>(List.of(like, like));
        String region = "";
        if (regionId != null) {
            region = " AND d.region_id = ?";
            args.add(regionId);
        }
        args.add(n + 1);
        args.add(offset);
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT d.id, d.name, d.region_id, r.name AS region_name,"
                        + " (SELECT COUNT(*) FROM depots p WHERE p.district_id = d.id) AS children"
                        + " FROM districts d LEFT JOIN regions r ON r.id = d.region_id"
                        + " WHERE (d.name LIKE ? OR r.name LIKE ?)" + region
                        + " ORDER BY d.name LIMIT ? OFFSET ?",
                args.toArray());
        return ResponseEntity.ok(page(rows, n, r -> item(r.get("id"), r.get("name"), r.get("region_id"), r.get("region_name"), r.get("children"))));
    }

    @GetMapping("/api/v1/regions/lookup/{id}")
    @Operation(summary = "One region (to show the current choice in a picker)")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> region(@PathVariable Long id) {
        return one(jdbc.queryForList("SELECT r.id, r.name, NULL AS parent_id, NULL AS parent_name, 0 AS children FROM regions r WHERE r.id = ?", id));
    }

    @GetMapping("/api/v1/districts/lookup/{id}")
    @Operation(summary = "One district with its region (to show the current choice in a picker)")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> district(@PathVariable Long id) {
        return one(jdbc.queryForList("SELECT d.id, d.name, d.region_id AS parent_id, r.name AS parent_name, 0 AS children"
                + " FROM districts d LEFT JOIN regions r ON r.id = d.region_id WHERE d.id = ?", id));
    }

    private static ResponseEntity<Map<String, Object>> one(List<Map<String, Object>> rows) {
        if (rows.isEmpty()) return ResponseEntity.notFound().build();
        Map<String, Object> r = rows.get(0);
        return ResponseEntity.ok(item(r.get("id"), r.get("name"), r.get("parent_id"), r.get("parent_name"), r.get("children")));
    }

    private static String like(String q) {
        String term = q == null ? "" : q.trim().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
        return "%" + term + "%";
    }

    private static Map<String, Object> item(Object id, Object name, Object parentId, Object parentName, Object children) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id);
        m.put("name", name);
        m.put("parentId", parentId);
        m.put("parentName", parentName);
        m.put("children", children);
        return m;
    }

    private static Map<String, Object> page(List<Map<String, Object>> rows, int size, java.util.function.Function<Map<String, Object>, Map<String, Object>> map) {
        boolean more = rows.size() > size;
        List<Map<String, Object>> items = new ArrayList<>();
        for (int i = 0; i < Math.min(size, rows.size()); i++) items.add(map.apply(rows.get(i)));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("items", items);
        out.put("hasMore", more);
        return out;
    }
}
