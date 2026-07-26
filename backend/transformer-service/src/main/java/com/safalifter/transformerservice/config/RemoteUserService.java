package com.safalifter.transformerservice.config;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

@FeignClient(name = "auth-service")
public interface RemoteUserService {
    @GetMapping("/api/v1/auth/access/email/{email}")
    UserAccessProfile getAccessByEmail(@PathVariable("email") String email);

    @GetMapping("/api/v1/auth/internal/chat-command-users/resolve")
    ChatCommandUserProfile resolveChatCommandUser(@RequestParam("contact") String contact);
}
