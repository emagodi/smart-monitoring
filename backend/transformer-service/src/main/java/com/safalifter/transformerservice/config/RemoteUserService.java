package com.safalifter.transformerservice.config;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@FeignClient(name = "auth-service")
public interface RemoteUserService {
    @GetMapping("/api/v1/auth/access/email/{email}")
    UserAccessProfile getAccessByEmail(@PathVariable("email") String email);
}
