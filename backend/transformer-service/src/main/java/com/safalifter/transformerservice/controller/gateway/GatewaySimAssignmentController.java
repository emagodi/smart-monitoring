package com.safalifter.transformerservice.controller.gateway;

import com.safalifter.transformerservice.payload.request.sim.SimAssignRequest;
import com.safalifter.transformerservice.payload.request.sim.SimUnassignRequest;
import com.safalifter.transformerservice.payload.response.sim.GatewaySimAssignmentResponse;
import com.safalifter.transformerservice.service.SimCardService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Gateway SIM Assignment Endpoints")
@RestController
@RequestMapping("/api/v1/gateways/{gatewayId}/sim-assignments")
@RequiredArgsConstructor
public class GatewaySimAssignmentController {

    private final SimCardService simCardService;

    @GetMapping
    @Operation(summary = "SIM assignment history for gateway")
    @PreAuthorize("hasAuthority('sims.view') OR hasAuthority('gateways.view') OR hasAuthority('READ_PRIVILEGE') OR hasRole('ADMINISTRATOR') OR hasRole('ADMIN')")
    public ResponseEntity<Page<GatewaySimAssignmentResponse>> history(
            @PathVariable Long gatewayId,
            @PageableDefault(size = 25, sort = "id", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        return ResponseEntity.ok(simCardService.getAssignmentHistory(gatewayId, pageable));
    }

    @PostMapping
    @Operation(summary = "Assign SIM card to gateway (transactional; closes previous active SIM on same gateway)")
    @PreAuthorize("(hasAuthority('sims.assign') OR hasAuthority('WRITE_PRIVILEGE') OR hasRole('ADMINISTRATOR') OR hasRole('ADMIN'))")
    public ResponseEntity<GatewaySimAssignmentResponse> assign(
            @PathVariable Long gatewayId,
            @Valid @RequestBody SimAssignRequest request
    ) {
        return ResponseEntity.ok(simCardService.assignSim(gatewayId, request));
    }

    @DeleteMapping("/{assignmentId}")
    @Operation(summary = "Unassign SIM assignment (deactivate; retains history row)")
    @PreAuthorize("(hasAuthority('sims.unassign') OR hasAuthority('DELETE_PRIVILEGE') OR hasRole('ADMINISTRATOR') OR hasRole('ADMIN'))")
    public ResponseEntity<GatewaySimAssignmentResponse> unassign(
            @PathVariable Long gatewayId,
            @PathVariable Long assignmentId,
            @RequestBody(required = false) SimUnassignRequest request
    ) {
        SimUnassignRequest r = request != null ? request : new SimUnassignRequest();
        return ResponseEntity.ok(simCardService.unassignSim(gatewayId, assignmentId, r));
    }
}
