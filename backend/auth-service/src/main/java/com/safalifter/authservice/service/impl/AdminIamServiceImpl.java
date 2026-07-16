package com.safalifter.authservice.service.impl;

import com.safalifter.authservice.entities.PermissionEntity;
import com.safalifter.authservice.entities.RoleEntity;
import com.safalifter.authservice.entities.User;
import com.safalifter.authservice.entities.UserTypeEntity;
import com.safalifter.authservice.enums.Role;
import com.safalifter.authservice.exception.UserNotFoundException;
import com.safalifter.authservice.payload.request.AdminUserRequest;
import com.safalifter.authservice.payload.request.PermissionRequest;
import com.safalifter.authservice.payload.request.ResetPasswordRequest;
import com.safalifter.authservice.payload.request.RoleRequest;
import com.safalifter.authservice.payload.request.UserTypeRequest;
import com.safalifter.authservice.payload.response.AdminUserResponse;
import com.safalifter.authservice.payload.response.PermissionResponse;
import com.safalifter.authservice.payload.response.RoleResponse;
import com.safalifter.authservice.payload.response.UserTypeResponse;
import com.safalifter.authservice.repository.PermissionRepository;
import com.safalifter.authservice.repository.RoleEntityRepository;
import com.safalifter.authservice.repository.UserRepository;
import com.safalifter.authservice.repository.UserTypeRepository;
import com.safalifter.authservice.service.AdminIamService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Transactional
public class AdminIamServiceImpl implements AdminIamService {

    private final UserRepository userRepository;
    private final RoleEntityRepository roleRepository;
    private final PermissionRepository permissionRepository;
    private final UserTypeRepository userTypeRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional(readOnly = true)
    public List<AdminUserResponse> listUsers() {
        return userRepository.findAllWithIam().stream().map(this::toAdminUserResponse).toList();
    }

    @Override
    public AdminUserResponse createUser(AdminUserRequest request) {
        User user = new User();
        applyUserRequest(user, request, true);
        return toAdminUserResponse(userRepository.save(user));
    }

    @Override
    public AdminUserResponse updateUser(Long userId, AdminUserRequest request) {
        User user = getUser(userId);
        applyUserRequest(user, request, false);
        return toAdminUserResponse(userRepository.save(user));
    }

    @Override
    public AdminUserResponse toggleUserStatus(Long userId, String status) {
        User user = getUser(userId);
        user.setStatus(status == null || status.isBlank() ? "ACTIVE" : status.toUpperCase());
        return toAdminUserResponse(userRepository.save(user));
    }

    @Override
    public AdminUserResponse assignRoles(Long userId, List<Long> roleIds) {
        User user = getUser(userId);
        user.setRoles(resolveRoles(roleIds));
        syncLegacyRole(user);
        return toAdminUserResponse(userRepository.save(user));
    }

    @Override
    public void deleteUser(Long userId) {
        userRepository.deleteById(userId);
    }

    @Override
    public void resetPassword(Long userId, ResetPasswordRequest request) {
        User user = getUser(userId);
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setTemporaryPassword(false);
        userRepository.save(user);
    }

    @Override
    @Transactional(readOnly = true)
    public List<RoleResponse> listRoles() {
        return roleRepository.findAll().stream().map(this::toRoleResponse).toList();
    }

    @Override
    public RoleResponse createRole(RoleRequest request) {
        RoleEntity role = RoleEntity.builder().build();
        applyRoleRequest(role, request);
        return toRoleResponse(roleRepository.save(role));
    }

    @Override
    public RoleResponse updateRole(Long roleId, RoleRequest request) {
        RoleEntity role = roleRepository.findById(roleId).orElseThrow(() -> new IllegalArgumentException("Role not found"));
        applyRoleRequest(role, request);
        return toRoleResponse(roleRepository.save(role));
    }

    @Override
    public void deleteRole(Long roleId) {
        roleRepository.deleteById(roleId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<PermissionResponse> listPermissions() {
        return permissionRepository.findAll().stream().map(this::toPermissionResponse).toList();
    }

    @Override
    public PermissionResponse createPermission(PermissionRequest request) {
        PermissionEntity permission = PermissionEntity.builder().build();
        applyPermissionRequest(permission, request);
        return toPermissionResponse(permissionRepository.save(permission));
    }

    @Override
    public PermissionResponse updatePermission(Long permissionId, PermissionRequest request) {
        PermissionEntity permission = permissionRepository.findById(permissionId)
                .orElseThrow(() -> new IllegalArgumentException("Permission not found"));
        applyPermissionRequest(permission, request);
        return toPermissionResponse(permissionRepository.save(permission));
    }

    @Override
    public void deletePermission(Long permissionId) {
        permissionRepository.deleteById(permissionId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<UserTypeResponse> listUserTypes() {
        return userTypeRepository.findAll().stream().map(this::toUserTypeResponse).toList();
    }

    @Override
    public UserTypeResponse createUserType(UserTypeRequest request) {
        UserTypeEntity entity = UserTypeEntity.builder().build();
        applyUserTypeRequest(entity, request);
        return toUserTypeResponse(userTypeRepository.save(entity));
    }

    @Override
    public UserTypeResponse updateUserType(Long userTypeId, UserTypeRequest request) {
        UserTypeEntity entity = userTypeRepository.findById(userTypeId)
                .orElseThrow(() -> new IllegalArgumentException("User type not found"));
        applyUserTypeRequest(entity, request);
        return toUserTypeResponse(userTypeRepository.save(entity));
    }

    @Override
    public void deleteUserType(Long userTypeId) {
        userTypeRepository.deleteById(userTypeId);
    }

    private void applyUserRequest(User user, AdminUserRequest request, boolean creating) {
        user.setFirstname(normalizeRequired(request.getFirstname()));
        user.setLastname(normalizeRequired(request.getLastname()));
        user.setEmail(normalizeRequired(request.getEmail()));
        user.setPhone(normalizeOptional(request.getPhone()));
        user.setEmployeeNumber(normalizeOptional(request.getEmployeeNumber()));
        user.setStatus(request.getStatus() == null || request.getStatus().isBlank() ? "ACTIVE" : request.getStatus().toUpperCase());
        user.setRegion(normalizeOptional(request.getRegion()));
        user.setRegionId(request.getRegionId());
        user.setDistrict(normalizeOptional(request.getDistrict()));
        user.setDistrictId(request.getDistrictId());
        user.setDepot(normalizeOptional(request.getDepot()));
        user.setDepotId(request.getDepotId());
        user.setUserType(resolveUserType(request.getUserTypeId()));
        user.setRoles(resolveRoles(request.getRoleIds()));
        syncLegacyRole(user);

        if (creating) {
            String rawPassword = (request.getPassword() == null || request.getPassword().isBlank()) ? "Password@123" : request.getPassword();
            user.setPassword(passwordEncoder.encode(rawPassword));
            user.setTemporaryPassword(false);
        } else if (request.getPassword() != null && !request.getPassword().isBlank()) {
            user.setPassword(passwordEncoder.encode(request.getPassword()));
        }
    }

    private void applyRoleRequest(RoleEntity role, RoleRequest request) {
        role.setName(request.getName());
        role.setDescription(request.getDescription());
        role.setStatus(request.getStatus() == null || request.getStatus().isBlank() ? "ACTIVE" : request.getStatus().toUpperCase());
        role.setPermissions(resolvePermissions(request.getPermissionIds()));
    }

    private void applyPermissionRequest(PermissionEntity permission, PermissionRequest request) {
        permission.setName(request.getName());
        permission.setModule(request.getModule());
        permission.setAction(request.getAction());
        permission.setDescription(request.getDescription());
        permission.setStatus(request.getStatus() == null || request.getStatus().isBlank() ? "ACTIVE" : request.getStatus().toUpperCase());
    }

    private void applyUserTypeRequest(UserTypeEntity entity, UserTypeRequest request) {
        entity.setName(request.getName());
        entity.setDescription(request.getDescription());
        entity.setStatus(request.getStatus() == null || request.getStatus().isBlank() ? "ACTIVE" : request.getStatus().toUpperCase());
    }

    private User getUser(Long userId) {
        return userRepository.findDetailedById(userId).orElseThrow(() -> new UserNotFoundException("User not found with ID: " + userId));
    }

    private UserTypeEntity resolveUserType(Long userTypeId) {
        if (userTypeId == null) {
            return null;
        }
        return userTypeRepository.findById(userTypeId).orElseThrow(() -> new IllegalArgumentException("User type not found"));
    }

    private Set<RoleEntity> resolveRoles(List<Long> roleIds) {
        if (roleIds == null || roleIds.isEmpty()) {
            return new HashSet<>();
        }
        return new HashSet<>(roleRepository.findAllById(roleIds));
    }

    private Set<PermissionEntity> resolvePermissions(List<Long> permissionIds) {
        if (permissionIds == null || permissionIds.isEmpty()) {
            return new HashSet<>();
        }
        return new HashSet<>(permissionRepository.findAllById(permissionIds));
    }

    private void syncLegacyRole(User user) {
        if (user.getRoles() != null && !user.getRoles().isEmpty()) {
            String primaryRole = user.getRoles().iterator().next().getName().toUpperCase().replace(' ', '_');
            try {
                user.setRole(Role.valueOf(primaryRole));
            } catch (IllegalArgumentException ignored) {
                user.setRole(Role.USER);
            }
        } else if (user.getRole() == null) {
            user.setRole(Role.USER);
        }
    }

    private String normalizeRequired(String value) {
        return value == null ? null : value.trim();
    }

    private String normalizeOptional(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private AdminUserResponse toAdminUserResponse(User user) {
        List<RoleEntity> assignedRoles = user.getId() != null ? roleRepository.findAllByUserId(user.getId()) : List.of();
        return AdminUserResponse.builder()
                .id(user.getId())
                .firstname(user.getFirstname())
                .lastname(user.getLastname())
                .email(user.getEmail())
                .phone(user.getPhone())
                .employeeNumber(user.getEmployeeNumber())
                .status(user.getStatus())
                .userType(user.getUserType() != null ? user.getUserType().getName() : null)
                .userTypeId(user.getUserType() != null ? user.getUserType().getId() : null)
                .roles(assignedRoles.stream().map(RoleEntity::getName).sorted(String::compareToIgnoreCase).toList())
                .roleIds(assignedRoles.stream().map(RoleEntity::getId).toList())
                .region(user.getRegion())
                .district(user.getDistrict())
                .depot(user.getDepot())
                .lastLoginAt(user.getLastLoginAt())
                .createdDate(user.getCreatedAt())
                .build();
    }

    private RoleResponse toRoleResponse(RoleEntity role) {
        return RoleResponse.builder()
                .id(role.getId())
                .name(role.getName())
                .description(role.getDescription())
                .status(role.getStatus())
                .usersAssigned(role.getId() != null ? Math.toIntExact(roleRepository.countUsersByRoleId(role.getId())) : 0)
                .permissionsCount(role.getPermissions().size())
                .permissionIds(role.getPermissions().stream().map(PermissionEntity::getId).toList())
                .permissions(role.getPermissions().stream().map(PermissionEntity::getName).sorted(String::compareToIgnoreCase).toList())
                .build();
    }

    private PermissionResponse toPermissionResponse(PermissionEntity permission) {
        return PermissionResponse.builder()
                .id(permission.getId())
                .name(permission.getName())
                .module(permission.getModule())
                .action(permission.getAction())
                .description(permission.getDescription())
                .status(permission.getStatus())
                .build();
    }

    private UserTypeResponse toUserTypeResponse(UserTypeEntity userType) {
        long count = userRepository.findAllWithIam().stream()
                .filter(user -> user.getUserType() != null && userType.getId().equals(user.getUserType().getId()))
                .count();

        return UserTypeResponse.builder()
                .id(userType.getId())
                .name(userType.getName())
                .description(userType.getDescription())
                .status(userType.getStatus())
                .userCount(count)
                .build();
    }
}
