package com.safalifter.transformerservice.client;

import com.safalifter.transformerservice.payload.response.UserResponse;
import com.safalifter.transformerservice.enums.Role;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.List;

@FeignClient(name = "auth-service")
public interface AuthClient {

    @GetMapping("/api/v1/auth/users/role/{role}/depot/{depotId}")
    List<UserResponse> getUsersByRoleAndDepot(@PathVariable("role") Role role, @PathVariable("depotId") Long depotId);

    @GetMapping("/api/v1/auth/user/email/{email}")
    Role getRoleByEmail(@PathVariable("email") String email);
}
