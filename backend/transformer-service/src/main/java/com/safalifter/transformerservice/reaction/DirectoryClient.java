package com.safalifter.transformerservice.reaction;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.List;
import java.util.Map;

/** ZESA group users of an area (auth-service, service-to-service only). */
@FeignClient(name = "auth-service", contextId = "authDirectory")
public interface DirectoryClient {
    @GetMapping("/api/v1/auth/internal/directory/users")
    List<Map<String, Object>> users(@RequestParam(value = "depotIds", required = false) String depotIds,
                                    @RequestParam(value = "regionId", required = false) Long regionId,
                                    @RequestParam(value = "includeNational", defaultValue = "true") boolean includeNational,
                                    @RequestParam(value = "ids", required = false) String ids);
}
