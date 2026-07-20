package com.safalifter.authservice.controller;

import com.safalifter.authservice.payload.request.AdminUserRequest;
import com.safalifter.authservice.payload.request.PermissionRequest;
import com.safalifter.authservice.payload.request.ResetPasswordRequest;
import com.safalifter.authservice.payload.request.RoleRequest;
import com.safalifter.authservice.payload.request.UserTypeRequest;
import com.safalifter.authservice.payload.response.AdminUserResponse;
import com.safalifter.authservice.payload.response.PermissionResponse;
import com.safalifter.authservice.payload.response.RoleResponse;
import com.safalifter.authservice.payload.response.SupplierResponse;
import com.safalifter.authservice.payload.response.UserTypeResponse;
import com.safalifter.authservice.service.AdminIamService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminIamController {

    private final AdminIamService adminIamService;

    @GetMapping("/users")
    @PreAuthorize("@rbacAuthorizationService.hasPermission(authentication, 'users.read')")
    public ResponseEntity<List<AdminUserResponse>> listUsers() {
        return ResponseEntity.ok(adminIamService.listUsers());
    }

    @PostMapping("/users")
    @PreAuthorize("@rbacAuthorizationService.hasPermission(authentication, 'users.create')")
    public ResponseEntity<AdminUserResponse> createUser(@RequestBody AdminUserRequest request) {
        return ResponseEntity.ok(adminIamService.createUser(request));
    }

    @PutMapping("/users/{userId}")
    @PreAuthorize("@rbacAuthorizationService.hasPermission(authentication, 'users.update')")
    public ResponseEntity<AdminUserResponse> updateUser(@PathVariable Long userId, @RequestBody AdminUserRequest request) {
        return ResponseEntity.ok(adminIamService.updateUser(userId, request));
    }

    @PatchMapping("/users/{userId}/status")
    @PreAuthorize("@rbacAuthorizationService.hasPermission(authentication, 'users.update')")
    public ResponseEntity<AdminUserResponse> toggleStatus(@PathVariable Long userId, @RequestParam String status) {
        return ResponseEntity.ok(adminIamService.toggleUserStatus(userId, status));
    }

    @PatchMapping("/users/{userId}/roles")
    @PreAuthorize("@rbacAuthorizationService.hasPermission(authentication, 'users.assign.role')")
    public ResponseEntity<AdminUserResponse> assignRoles(@PathVariable Long userId, @RequestBody Map<String, List<Long>> request) {
        return ResponseEntity.ok(adminIamService.assignRoles(userId, request.get("roleIds")));
    }

    @PostMapping("/users/{userId}/reset-password")
    @PreAuthorize("@rbacAuthorizationService.hasPermission(authentication, 'users.reset.password')")
    public ResponseEntity<Void> resetPassword(@PathVariable Long userId, @RequestBody ResetPasswordRequest request) {
        adminIamService.resetPassword(userId, request);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/users/{userId}")
    @PreAuthorize("@rbacAuthorizationService.hasPermission(authentication, 'users.delete')")
    public ResponseEntity<Void> deleteUser(@PathVariable Long userId) {
        adminIamService.deleteUser(userId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/roles")
    @PreAuthorize("@rbacAuthorizationService.hasPermission(authentication, 'roles.read')")
    public ResponseEntity<List<RoleResponse>> listRoles() {
        return ResponseEntity.ok(adminIamService.listRoles());
    }

    @PostMapping("/roles")
    @PreAuthorize("@rbacAuthorizationService.hasPermission(authentication, 'roles.create')")
    public ResponseEntity<RoleResponse> createRole(@RequestBody RoleRequest request) {
        return ResponseEntity.ok(adminIamService.createRole(request));
    }

    @PutMapping("/roles/{roleId}")
    @PreAuthorize("@rbacAuthorizationService.hasPermission(authentication, 'roles.update')")
    public ResponseEntity<RoleResponse> updateRole(@PathVariable Long roleId, @RequestBody RoleRequest request) {
        return ResponseEntity.ok(adminIamService.updateRole(roleId, request));
    }

    @DeleteMapping("/roles/{roleId}")
    @PreAuthorize("@rbacAuthorizationService.hasPermission(authentication, 'roles.delete')")
    public ResponseEntity<Void> deleteRole(@PathVariable Long roleId) {
        adminIamService.deleteRole(roleId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/permissions")
    @PreAuthorize("@rbacAuthorizationService.hasPermission(authentication, 'permissions.read')")
    public ResponseEntity<List<PermissionResponse>> listPermissions() {
        return ResponseEntity.ok(adminIamService.listPermissions());
    }

    @PostMapping("/permissions")
    @PreAuthorize("@rbacAuthorizationService.hasPermission(authentication, 'permissions.create')")
    public ResponseEntity<PermissionResponse> createPermission(@RequestBody PermissionRequest request) {
        return ResponseEntity.ok(adminIamService.createPermission(request));
    }

    @PutMapping("/permissions/{permissionId}")
    @PreAuthorize("@rbacAuthorizationService.hasPermission(authentication, 'permissions.update')")
    public ResponseEntity<PermissionResponse> updatePermission(@PathVariable Long permissionId, @RequestBody PermissionRequest request) {
        return ResponseEntity.ok(adminIamService.updatePermission(permissionId, request));
    }

    @DeleteMapping("/permissions/{permissionId}")
    @PreAuthorize("@rbacAuthorizationService.hasPermission(authentication, 'permissions.delete')")
    public ResponseEntity<Void> deletePermission(@PathVariable Long permissionId) {
        adminIamService.deletePermission(permissionId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/user-types")
    @PreAuthorize("@rbacAuthorizationService.hasPermission(authentication, 'usertypes.read')")
    public ResponseEntity<List<UserTypeResponse>> listUserTypes() {
        return ResponseEntity.ok(adminIamService.listUserTypes());
    }

    @GetMapping("/suppliers")
    @PreAuthorize("@rbacAuthorizationService.hasPermission(authentication, 'users.read')")
    public ResponseEntity<List<SupplierResponse>> listSuppliers() {
        return ResponseEntity.ok(adminIamService.listSuppliers());
    }

    @PostMapping("/user-types")
    @PreAuthorize("@rbacAuthorizationService.hasPermission(authentication, 'usertypes.create')")
    public ResponseEntity<UserTypeResponse> createUserType(@RequestBody UserTypeRequest request) {
        return ResponseEntity.ok(adminIamService.createUserType(request));
    }

    @PutMapping("/user-types/{userTypeId}")
    @PreAuthorize("@rbacAuthorizationService.hasPermission(authentication, 'usertypes.update')")
    public ResponseEntity<UserTypeResponse> updateUserType(@PathVariable Long userTypeId, @RequestBody UserTypeRequest request) {
        return ResponseEntity.ok(adminIamService.updateUserType(userTypeId, request));
    }

    @DeleteMapping("/user-types/{userTypeId}")
    @PreAuthorize("@rbacAuthorizationService.hasPermission(authentication, 'usertypes.delete')")
    public ResponseEntity<Void> deleteUserType(@PathVariable Long userTypeId) {
        adminIamService.deleteUserType(userTypeId);
        return ResponseEntity.noContent().build();
    }
}
