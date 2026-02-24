package com.safalifter.transformerservice.config;

import com.safalifter.transformerservice.enums.Role;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@FeignClient(name = "auth-service")
public interface RemoteUserService {
    @GetMapping("/api/v1/auth/user/email/{email}")
    Role getRoleByEmail(@PathVariable("email") String email);
}