package com.safalifter.transformerservice.controller;

import com.safalifter.transformerservice.service.DashboardService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/** Dashboard charts and the notification bell (both scoped to the caller and cached briefly). */
@Tag(name = "Dashboards")
@RestController
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping("/api/v1/alerts/trends")
    @Operation(summary = "Alerts per hour (24 h) and per day (14 days), triggers and outcomes (7 days), busiest transformers")
    public ResponseEntity<Map<String, Object>> trends() {
        return ResponseEntity.ok(dashboardService.trends());
    }

    @GetMapping("/api/v1/alerts/notifications")
    @Operation(summary = "Notification feed for the signed-in user: alerts, response activity and system notices they may see")
    public ResponseEntity<List<Map<String, Object>>> notifications() {
        return ResponseEntity.ok(dashboardService.notifications());
    }
}
