package com.safalifter.transformerservice.reaction;

import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** TIAS mobile app: push-notification registration. Everything else uses the same endpoints as the web. */
@RestController
@RequiredArgsConstructor
public class MobileController {

    private final MobilePushService pushService;

    @PostMapping("/api/v1/mobile/devices")
    @Operation(summary = "Register this phone's Expo push token for the signed-in user (alerts with the siren sound)")
    public Map<String, Object> register(@RequestBody MobilePushService.Register body) {
        return pushService.register(body);
    }

    @PostMapping("/api/v1/mobile/devices/unregister")
    @Operation(summary = "Stop pushing to this phone (called on sign-out)")
    public Map<String, Object> unregister(@RequestBody MobilePushService.Unregister body) {
        pushService.unregister(body);
        return Map.of("unregistered", true);
    }
}
