package com.safalifter.authservice.config;

import com.safalifter.authservice.entities.PermissionEntity;
import com.safalifter.authservice.entities.RoleEntity;
import com.safalifter.authservice.entities.SupplierEntity;
import com.safalifter.authservice.entities.User;
import com.safalifter.authservice.entities.UserTypeEntity;
import com.safalifter.authservice.enums.Role;
import com.safalifter.authservice.repository.PermissionRepository;
import com.safalifter.authservice.repository.RoleEntityRepository;
import com.safalifter.authservice.repository.SupplierRepository;
import com.safalifter.authservice.repository.UserRepository;
import com.safalifter.authservice.repository.UserTypeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

@Component
@RequiredArgsConstructor
public class DataLoader implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final PermissionRepository permissionRepository;
    private final RoleEntityRepository roleRepository;
    private final UserTypeRepository userTypeRepository;
    private final SupplierRepository supplierRepository;
    private final JdbcTemplate jdbcTemplate;

    /** Seed one ready-to-use account per user type and per operational role (testing / UAT). */
    @Value("${app.seed.test-users:true}")
    private boolean seedTestUsers = true;

    /** Shared password for the seeded test accounts. Set app.seed.test-users=false on production. */
    public static final String TEST_PASSWORD = "Password@123";

    @Override
    public void run(String... args) {
        seedUserTypes();
        seedSuppliers();
        seedPermissions();
        // Sensors were retired (the system works with controllers only): drop their permissions everywhere.
        purgeObsoletePermissions(List.of("cameras", "simulation", "sensors"));
        seedAdministratorRole();
        seedSupplierAdministratorRole();
        seedOperationalRoles();
        createOrUpdateSuperAdmin();
        createOrUpdateOculusSupplierUser();
        if (seedTestUsers) {
            seedTestUsers();
        }
    }

    /**
     * Test personas (all with password Password@123, reset on every start so testers can rely on it):
     *   agent@powertel.co.zw        Contact Centre Agent   (ZESA, national)
     *   dispatcher@powertel.co.zw   Dispatcher             (ZESA, national)
     *   supervisor@powertel.co.zw   Loss Control Supervisor(ZESA, national)
     *   depot.user@powertel.co.zw   Dispatcher             (ZESA, scoped to the first depot)
     *   magodi@oculus.co.zw         Supplier Administrator (Oculus partner portal)
     * plus <usertype>.test@powertel.co.zw for every other user type that has no user yet.
     */
    private void seedTestUsers() {
        UserTypeEntity zesa = userTypeRepository.findByName("ZESA").orElse(null);
        seedPersona("agent@powertel.co.zw", "Tariro", "Agent", "Contact Centre Agent", zesa, null, false);
        seedPersona("dispatcher@powertel.co.zw", "Tendai", "Dispatcher", "Dispatcher", zesa, null, false);
        seedPersona("supervisor@powertel.co.zw", "Rudo", "Supervisor", "Loss Control Supervisor", zesa, null, false);
        seedPersona("depot.user@powertel.co.zw", "Farai", "Depot", "Dispatcher", zesa, null, true);
        userRepository.findByEmail("magodi@oculus.co.zw").ifPresent(u -> {
            u.setPassword(passwordEncoder.encode(TEST_PASSWORD));
            u.setTemporaryPassword(false);
            userRepository.save(u);
        });

        for (UserTypeEntity type : userTypeRepository.findAll()) {
            if (type.getName() == null || "ZESA".equalsIgnoreCase(type.getName()) || "Supplier".equalsIgnoreCase(type.getName())) {
                continue;
            }
            Integer users = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM _user WHERE user_type_id = ?", Integer.class, type.getId());
            if (users != null && users > 0) {
                continue;
            }
            String slug = type.getName().toLowerCase().replaceAll("[^a-z0-9]+", ".").replaceAll("^\\.|\\.$", "");
            boolean partner = type.getName().toLowerCase().contains("supplier") || type.getName().toLowerCase().contains("partner");
            seedPersona(slug + ".test@powertel.co.zw", type.getName(), "Tester",
                    partner ? "Supplier Administrator" : "Contact Centre Agent", type, partner ? "oculus" : null, false);
        }
    }

    private void seedPersona(String email, String first, String last, String roleName, UserTypeEntity type,
                             String supplierCode, boolean depotScoped) {
        try {
            User user = userRepository.findByEmail(email).orElseGet(User::new);
            user.setEmail(email);
            if (user.getFirstname() == null) user.setFirstname(first);
            if (user.getLastname() == null) user.setLastname(last);
            user.setPassword(passwordEncoder.encode(TEST_PASSWORD));
            user.setTemporaryPassword(false);
            user.setStatus("ACTIVE");
            if (user.getRole() == null) user.setRole(Role.USER);
            user.setUserType(type);
            user.setSupplier(supplierCode != null ? supplierRepository.findByCode(supplierCode).orElse(null) : null);
            if (depotScoped) {
                List<Map<String, Object>> depot = jdbcTemplate.queryForList("""
                        SELECT d.id AS depot_id, d.name AS depot, di.id AS district_id, di.name AS district,
                               r.id AS region_id, r.name AS region
                          FROM depots d
                          LEFT JOIN districts di ON di.id = d.district_id
                          LEFT JOIN regions r ON r.id = di.region_id
                         ORDER BY d.id LIMIT 1
                        """);
                if (!depot.isEmpty()) {
                    Map<String, Object> d = depot.get(0);
                    user.setDepotId(((Number) d.get("depot_id")).longValue());
                    user.setDepot((String) d.get("depot"));
                    user.setDistrictId(d.get("district_id") != null ? ((Number) d.get("district_id")).longValue() : null);
                    user.setDistrict((String) d.get("district"));
                    user.setRegionId(d.get("region_id") != null ? ((Number) d.get("region_id")).longValue() : null);
                    user.setRegion((String) d.get("region"));
                    user.setLastname("User (" + d.get("depot") + ")");
                }
            }
            userRepository.save(user);
            roleRepository.findByName(roleName).ifPresent(role -> {
                jdbcTemplate.update("DELETE FROM user_roles WHERE user_id = ?", user.getId());
                assignRoleIfMissing(user.getId(), role.getId());
            });
        } catch (Exception e) {
            org.slf4j.LoggerFactory.getLogger(DataLoader.class).warn("Could not seed test user {}: {}", email, e.getMessage());
        }
    }

    private void seedUserTypes() {
        upsertUserType("ZESA", "Internal organization users");
        upsertUserType("Supplier", "Supplier-scoped external users");
    }

    private void seedSuppliers() {
        upsertSupplier("oculus", "Oculus", "Supplier integration for Oculus websocket and Dragino telemetry");
    }

    private void seedPermissions() {
        Map<String, List<String>> moduleActions = new LinkedHashMap<>();
        moduleActions.put("users", List.of("create", "read", "update", "delete", "assign.role", "reset.password"));
        moduleActions.put("roles", List.of("create", "read", "update", "delete"));
        moduleActions.put("permissions", List.of("create", "read", "update", "delete"));
        moduleActions.put("usertypes", List.of("create", "read", "update", "delete"));
        moduleActions.put("dashboard", List.of("read", "zesa", "supplier"));
        moduleActions.put("regions", List.of("create", "read", "update", "delete"));
        moduleActions.put("districts", List.of("create", "read", "update", "delete"));
        moduleActions.put("depots", List.of("create", "read", "update", "delete"));
        moduleActions.put("sites", List.of("create", "read", "update", "delete"));
        moduleActions.put("transformers", List.of("create", "read", "update", "delete"));
        moduleActions.put("controllers", List.of("create", "read", "update", "delete"));
        moduleActions.put("alerts", List.of("create", "read", "update", "delete"));
        moduleActions.put("reports", List.of("read", "export"));
        moduleActions.put("gateways", List.of("view", "create", "edit", "sync", "assign_customer", "update_location", "audit_view"));
        moduleActions.put("sims", List.of("view", "create", "edit", "assign", "unassign", "view_sensitive"));
        // Incident response lifecycle (contact centre -> dispatch -> crew -> outcome)
        moduleActions.put("response", List.of("read", "acknowledge", "dispatch", "close"));
        moduleActions.put("fleet", List.of("read", "update"));
        // Arm / disarm controllers (Oculus control, chat commands)
        moduleActions.put("control", List.of("arm", "disarm"));
        // Partner telemetry feeds (LORIOT apps / HTTP push) and their decoders
        moduleActions.put("integrations", List.of("read", "manage"));

        moduleActions.forEach((module, actions) -> actions.forEach(action -> upsertPermission(module, action)));
    }

    private void purgeObsoletePermissions(List<String> modules) {
        if (modules == null || modules.isEmpty()) {
            return;
        }
        String placeholders = String.join(",", java.util.Collections.nCopies(modules.size(), "?"));
        jdbcTemplate.update(
                "DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE module IN (" + placeholders + "))",
                modules.toArray()
        );
        jdbcTemplate.update(
                "DELETE FROM permissions WHERE module IN (" + placeholders + ")",
                modules.toArray()
        );
    }

    private void seedAdministratorRole() {
        RoleEntity administratorRole = roleRepository.findByName("Administrator")
                .orElseGet(() -> RoleEntity.builder()
                        .name("Administrator")
                        .description("Full system access")
                        .status("ACTIVE")
                        .build());
        administratorRole.setPermissions(Set.copyOf(permissionRepository.findAll()));
        roleRepository.save(administratorRole);
    }

    private void seedSupplierAdministratorRole() {
        RoleEntity supplierRole = roleRepository.findByName("Supplier Administrator")
                .orElseGet(() -> RoleEntity.builder()
                        .name("Supplier Administrator")
                        .description("Supplier-scoped portal access for owned transformers, controllers and alerts")
                        .status("ACTIVE")
                        .build());
        supplierRole.setPermissions(resolvePermissionsByName(List.of(
                "dashboard.read",
                "dashboard.supplier",
                "regions.read",
                "districts.read",
                "depots.read",
                "transformers.read",
                "controllers.create",
                "controllers.read",
                "controllers.update",
                "alerts.read",
                "sites.read",
                "response.read",
                // partners keep arm/disarm of their own transformers (web + WhatsApp)
                "control.arm",
                "control.disarm"
        )));
        roleRepository.save(supplierRole);
    }

    /**
     * Ready-made roles for the response workflow. Created only when missing, so any changes an
     * administrator makes on the Roles screen are never overwritten on restart.
     */
    private void seedOperationalRoles() {
        createRoleIfMissing("Contact Centre Agent",
                "Watches the live alert queue, acknowledges alerts and arms/disarms transformers",
                List.of("dashboard.read", "dashboard.zesa", "regions.read", "districts.read", "depots.read",
                        "transformers.read", "controllers.read", "sites.read",
                        "alerts.read", "alerts.update", "response.read", "response.acknowledge",
                        "fleet.read", "control.arm", "control.disarm", "gateways.view"));
        createRoleIfMissing("Dispatcher",
                "Dispatches rapid-response vehicles and tracks crews to closure",
                List.of("dashboard.read", "dashboard.zesa", "regions.read", "districts.read", "depots.read",
                        "transformers.read", "controllers.read", "alerts.read", "alerts.update",
                        "response.read", "response.acknowledge", "response.dispatch", "response.close",
                        "fleet.read", "fleet.update", "control.arm", "control.disarm"));
        createRoleIfMissing("Loss Control Supervisor",
                "Oversees incidents, outcomes and response times across depots",
                List.of("dashboard.read", "dashboard.zesa", "regions.read", "districts.read", "depots.read",
                        "transformers.read", "controllers.read", "sites.read",
                        "alerts.read", "alerts.update", "reports.read", "reports.export",
                        "response.read", "response.acknowledge", "response.dispatch", "response.close",
                        "fleet.read", "fleet.update", "gateways.view"));
    }

    private void createRoleIfMissing(String name, String description, List<String> permissionNames) {
        if (roleRepository.findByName(name).isPresent()) {
            return;
        }
        roleRepository.save(RoleEntity.builder()
                .name(name)
                .description(description)
                .status("ACTIVE")
                .permissions(new java.util.HashSet<>(resolvePermissionsByName(permissionNames)))
                .build());
    }

    private void createOrUpdateSuperAdmin() {
        RoleEntity adminRole = roleRepository.findByName("Administrator").orElseThrow();
        UserTypeEntity zesaType = userTypeRepository.findByName("ZESA").orElse(null);

        User adminUser = userRepository.findByEmail("emagodi1@powertel.co.zw").orElseGet(User::new);
        adminUser.setFirstname("Edwin");
        adminUser.setLastname("Magodi");
        adminUser.setEmail("emagodi1@powertel.co.zw");
        if (adminUser.getPassword() == null || adminUser.getPassword().isBlank()) {
            adminUser.setPassword(passwordEncoder.encode("Password@123"));
        }
        adminUser.setRole(Role.ADMIN);
        adminUser.setStatus("ACTIVE");
        adminUser.setTemporaryPassword(false);
        adminUser.setUserType(zesaType);
        adminUser.setSupplier(null);
        // Super admin: national scope, sees and does everything
        adminUser.setDepotId(null);
        adminUser.setDepot(null);
        adminUser.setDistrictId(null);
        adminUser.setDistrict(null);
        adminUser.setRegionId(null);
        adminUser.setRegion(null);
        if (seedTestUsers) {
            adminUser.setPassword(passwordEncoder.encode(TEST_PASSWORD));
        }
        userRepository.save(adminUser);
        assignRoleIfMissing(adminUser.getId(), adminRole.getId());

        userRepository.findAll().stream()
                .filter(user -> user.getEmail() != null && user.getEmail().toLowerCase().startsWith("emagodi"))
                .filter(user -> !Objects.equals(user.getId(), adminUser.getId()))
                .forEach(user -> {
                    boolean changed = false;
                    if (!"ACTIVE".equalsIgnoreCase(user.getStatus())) {
                        user.setStatus("ACTIVE");
                        changed = true;
                    }
                    if (user.getRole() != Role.ADMIN) {
                        user.setRole(Role.ADMIN);
                        changed = true;
                    }
                    if (user.getUserType() == null || !Objects.equals(user.getUserType().getId(), zesaType != null ? zesaType.getId() : null)) {
                        user.setUserType(zesaType);
                        changed = true;
                    }
                    if (user.getSupplier() != null) {
                        user.setSupplier(null);
                        changed = true;
                    }
                    if (changed) {
                        userRepository.save(user);
                    }
                    assignRoleIfMissing(user.getId(), adminRole.getId());
                });
    }

    private void createOrUpdateOculusSupplierUser() {
        RoleEntity supplierRole = roleRepository.findByName("Supplier Administrator").orElseThrow();
        UserTypeEntity supplierType = userTypeRepository.findByName("Supplier").orElse(null);
        SupplierEntity oculus = supplierRepository.findByCode("oculus").orElseThrow();

        User supplierUser = userRepository.findByEmail("magodi@oculus.co.zw").orElseGet(User::new);
        supplierUser.setFirstname("Edwin");
        supplierUser.setLastname("Magodi");
        supplierUser.setEmail("magodi@oculus.co.zw");
        if (supplierUser.getPassword() == null || supplierUser.getPassword().isBlank()) {
            // first creation only: never reset a password the partner has changed
            supplierUser.setPassword(passwordEncoder.encode("Password@123"));
            supplierUser.setTemporaryPassword(true);
        }
        supplierUser.setRole(Role.USER);
        supplierUser.setStatus("ACTIVE");
        supplierUser.setUserType(supplierType);
        supplierUser.setSupplier(oculus);
        supplierUser.setRegion(null);
        supplierUser.setRegionId(null);
        supplierUser.setDistrict(null);
        supplierUser.setDistrictId(null);
        supplierUser.setDepot(null);
        supplierUser.setDepotId(null);
        userRepository.save(supplierUser);
        assignRoleIfMissing(supplierUser.getId(), supplierRole.getId());
    }

    private void assignRoleIfMissing(Long userId, Long roleId) {
        if (userId == null || roleId == null) {
            return;
        }
        jdbcTemplate.update("INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)", userId, roleId);
    }

    private void upsertUserType(String name, String description) {
        UserTypeEntity type = userTypeRepository.findByName(name).orElseGet(UserTypeEntity::new);
        type.setName(name);
        type.setDescription(description);
        type.setStatus("ACTIVE");
        userTypeRepository.save(type);
    }

    private void upsertSupplier(String code, String name, String description) {
        SupplierEntity supplier = supplierRepository.findByCode(code).orElseGet(SupplierEntity::new);
        supplier.setCode(code);
        supplier.setName(name);
        supplier.setDescription(description);
        supplier.setStatus("ACTIVE");
        supplierRepository.save(supplier);
    }

    private void upsertPermission(String module, String action) {
        String name = module + "." + action;
        PermissionEntity permission = permissionRepository.findByName(name).orElseGet(PermissionEntity::new);
        permission.setName(name);
        permission.setModule(module);
        permission.setAction(action);
        permission.setDescription("Allows " + action + " access on " + module);
        permission.setStatus("ACTIVE");
        permissionRepository.save(permission);
    }

    private Set<PermissionEntity> resolvePermissionsByName(List<String> permissionNames) {
        return permissionNames.stream()
                .map(permissionRepository::findByName)
                .filter(Optional::isPresent)
                .map(Optional::get)
                .collect(java.util.stream.Collectors.toSet());
    }
}
