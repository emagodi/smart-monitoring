package com.safalifter.authservice.payload.response;

import com.safalifter.authservice.enums.Role;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserAccessResponse {
    private Role role;
    private String userType;
    private Long supplierId;
    private String supplierCode;
    private String supplierName;
    private Long depotId;
    /** Active permission names from all of the user's active roles, e.g. "response.dispatch". */
    private java.util.Set<String> permissions;
}
