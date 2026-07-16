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

    @Override
    public void run(String... args) {
        seedUserTypes();
        seedSuppliers();
        seedPermissions();
        purgeObsoletePermissions(List.of("cameras", "simulation"));
        seedAdministratorRole();
        seedSupplierAdministratorRole();
        createOrUpdateSuperAdmin();
        createOrUpdateOculusSupplierUser();
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
        moduleActions.put("sensors", List.of("create", "read", "update", "delete"));
        moduleActions.put("reports", List.of("read", "export"));

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
                        .description("Supplier-scoped portal access for owned transformers, controllers, sensors, and alerts")
                        .status("ACTIVE")
                        .build());
        supplierRole.setPermissions(resolvePermissionsByName(List.of(
                "dashboard.read",
                "dashboard.supplier",
                "transformers.create",
                "transformers.read",
                "transformers.update",
                "controllers.create",
                "controllers.read",
                "controllers.update",
                "sensors.create",
                "sensors.read",
                "sensors.update",
                "sites.read"
        )));
        roleRepository.save(supplierRole);
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
        supplierUser.setPassword(passwordEncoder.encode("Password@123"));
        supplierUser.setRole(Role.USER);
        supplierUser.setStatus("ACTIVE");
        supplierUser.setTemporaryPassword(false);
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
