package com.safalifter.authservice.service;

import com.safalifter.authservice.entities.RoleEntity;
import com.safalifter.authservice.entities.SupplierEntity;
import com.safalifter.authservice.entities.User;
import com.safalifter.authservice.entities.UserTypeEntity;
import com.safalifter.authservice.payload.request.AdminUserRequest;
import com.safalifter.authservice.payload.response.AdminUserResponse;
import com.safalifter.authservice.repository.RoleEntityRepository;
import com.safalifter.authservice.repository.SupplierRepository;
import com.safalifter.authservice.repository.UserRepository;
import com.safalifter.authservice.repository.UserTypeRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

@SpringBootTest(properties = {
        "spring.cloud.config.enabled=false",
        "spring.cloud.bootstrap.enabled=false",
        "spring.config.import=",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.url=jdbc:h2:mem:authdb;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@Transactional
class AdminIamServiceDebugTest {

    @Autowired
    private AdminIamService adminIamService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleEntityRepository roleEntityRepository;

    @Autowired
    private UserTypeRepository userTypeRepository;

    @Autowired
    private SupplierRepository supplierRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Test
    void updatesSupplierUserWithWhatsappNumber() {
        RoleEntity supplierAdminRole = roleEntityRepository.findByName("Supplier Administrator")
                .orElseGet(() -> roleEntityRepository.save(RoleEntity.builder()
                        .name("Supplier Administrator")
                        .description("Supplier admin role")
                        .status("ACTIVE")
                        .build()));

        UserTypeEntity supplierType = userTypeRepository.findByName("Supplier")
                .orElseGet(() -> userTypeRepository.save(UserTypeEntity.builder()
                        .name("Supplier")
                        .description("Supplier scoped debug type")
                        .status("ACTIVE")
                        .build()));

        SupplierEntity supplier = supplierRepository.findByCodeIgnoreCase("oculus")
                .orElseGet(() -> supplierRepository.save(SupplierEntity.builder()
                        .code("oculus")
                        .name("Oculus")
                        .status("ACTIVE")
                        .build()));

        User user = userRepository.save(User.builder()
                .firstname("Edwin")
                .lastname("Magodi")
                .email("debug-edwin@example.com")
                .password(passwordEncoder.encode("Password@123"))
                .status("ACTIVE")
                .roles(Set.of(supplierAdminRole))
                .build());

        AdminUserRequest request = AdminUserRequest.builder()
                .firstname("Edwin")
                .lastname("Magodi")
                .email("debug-edwin@example.com")
                .phone("+263773537476")
                .whatsappNumber("+263773537476")
                .employeeNumber("EMP-DEBUG-1")
                .status("ACTIVE")
                .userTypeId(supplierType.getId())
                .supplierId(supplier.getId())
                .roleIds(List.of(supplierAdminRole.getId()))
                .build();

        AdminUserResponse response = adminIamService.updateUser(user.getId(), request);

        assertNotNull(response);
        assertEquals("+263773537476", response.getWhatsappNumber());
        assertEquals("Oculus", response.getSupplierName());
        assertEquals("Supplier", response.getUserType());
    }
}
