package com.safalifter.transformerservice.config;

import com.safalifter.transformerservice.enums.Role;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserAccessProfile {
    private Role role;
    private String userType;
    private Long supplierId;
    private String supplierCode;
    private String supplierName;
    private Long depotId;
    /** Tick-box permission names from the user's roles (e.g. "response.dispatch"); null on older auth-service builds. */
    private java.util.Set<String> permissions;
}
