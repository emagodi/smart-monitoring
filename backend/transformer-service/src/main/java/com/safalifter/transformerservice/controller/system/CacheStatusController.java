package com.safalifter.transformerservice.controller.system;

import com.safalifter.transformerservice.cache.SharedCache;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** Admin check on the Redis cache: connected?, hit rate, memory, keys. */
@RestController
@RequiredArgsConstructor
public class CacheStatusController {

    private final SharedCache sharedCache;

    @GetMapping("/api/v1/transformers/system/cache")
    @PreAuthorize("hasRole('ADMINISTRATOR') OR hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> status() {
        return ResponseEntity.ok(sharedCache.status());
    }
}
