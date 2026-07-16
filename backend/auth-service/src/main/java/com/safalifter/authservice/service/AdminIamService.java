package com.safalifter.authservice.service;

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

import java.util.List;

public interface AdminIamService {
    List<AdminUserResponse> listUsers();
    AdminUserResponse createUser(AdminUserRequest request);
    AdminUserResponse updateUser(Long userId, AdminUserRequest request);
    AdminUserResponse toggleUserStatus(Long userId, String status);
    AdminUserResponse assignRoles(Long userId, List<Long> roleIds);
    void deleteUser(Long userId);
    void resetPassword(Long userId, ResetPasswordRequest request);

    List<RoleResponse> listRoles();
    RoleResponse createRole(RoleRequest request);
    RoleResponse updateRole(Long roleId, RoleRequest request);
    void deleteRole(Long roleId);

    List<PermissionResponse> listPermissions();
    PermissionResponse createPermission(PermissionRequest request);
    PermissionResponse updatePermission(Long permissionId, PermissionRequest request);
    void deletePermission(Long permissionId);

    List<UserTypeResponse> listUserTypes();
    UserTypeResponse createUserType(UserTypeRequest request);
    UserTypeResponse updateUserType(Long userTypeId, UserTypeRequest request);
    void deleteUserType(Long userTypeId);

    List<SupplierResponse> listSuppliers();
}
