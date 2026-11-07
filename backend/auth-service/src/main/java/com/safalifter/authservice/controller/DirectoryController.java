package com.safalifter.authservice.controller;

import com.safalifter.authservice.entities.PermissionEntity;
import com.safalifter.authservice.entities.RoleEntity;
import com.safalifter.authservice.entities.User;
import com.safalifter.authservice.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Service-to-service user directory (ZESA group staff only, never partners) used by transformer-service for the
 * Loss Control duty roster: who works in a region / depot and how to reach them. Not routed by the API gateway.
 */
@RestController
@RequestMapping("/api/v1/auth/internal/directory")
@RequiredArgsConstructor
public class DirectoryController {

    private final UserRepository userRepository;

    /**
     * Internal users for an area: users of these depots, users of the region with no depot, and national users
     * (no region and no depot). With includeNational=false only the area's own users are returned.
     */
    @GetMapping("/users")
    public List<Map<String, Object>> users(@RequestParam(required = false) String depotIds,
                                           @RequestParam(required = false) Long regionId,
                                           @RequestParam(defaultValue = "true") boolean includeNational,
                                           @RequestParam(required = false) String ids) {
        Set<Long> depots = parse(depotIds);
        Set<Long> only = parse(ids);
        return userRepository.findAllWithIam().stream()
                .filter(User::isEnabled)
                .filter(u -> u.getSupplier() == null)
                .filter(u -> {
                    if (!only.isEmpty()) return only.contains(u.getId());
                    if (u.getDepotId() != null) return depots.contains(u.getDepotId());
                    if (u.getRegionId() != null) return regionId != null && regionId.equals(u.getRegionId());
                    return includeNational;
                })
                .map(this::toEntry)
                .sorted((a, b) -> String.valueOf(a.get("name")).compareToIgnoreCase(String.valueOf(b.get("name"))))
                .toList();
    }

    private Map<String, Object> toEntry(User u) {
        Set<String> perms = u.getRoles() == null ? Set.of() : u.getRoles().stream()
                .filter(Objects::nonNull)
                .flatMap(r -> r.getPermissions() == null ? java.util.stream.Stream.<PermissionEntity>empty() : r.getPermissions().stream())
                .map(PermissionEntity::getName).filter(Objects::nonNull).collect(Collectors.toSet());
        boolean admin = u.getRole() != null && u.getRole().name().toUpperCase().contains("ADMIN");
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", u.getId());
        m.put("name", ((u.getFirstname() == null ? "" : u.getFirstname()) + " " + (u.getLastname() == null ? "" : u.getLastname())).trim());
        m.put("email", u.getEmail());
        m.put("phone", u.getPhone());
        m.put("whatsappNumber", u.getWhatsappNumber());
        m.put("regionId", u.getRegionId());
        m.put("region", u.getRegion());
        m.put("districtId", u.getDistrictId());
        m.put("district", u.getDistrict());
        m.put("depotId", u.getDepotId());
        m.put("depot", u.getDepot());
        m.put("userType", u.getUserType() != null ? u.getUserType().getName() : null);
        m.put("roles", u.getRoles() == null ? List.of() : u.getRoles().stream().map(RoleEntity::getName).filter(Objects::nonNull).sorted().toList());
        m.put("canAcknowledge", admin || perms.contains("response.acknowledge"));
        return m;
    }

    private static Set<Long> parse(String csv) {
        if (csv == null || csv.isBlank()) return Set.of();
        return Arrays.stream(csv.split(",")).map(String::trim).filter(s -> s.matches("\\d+")).map(Long::valueOf).collect(Collectors.toSet());
    }
}
