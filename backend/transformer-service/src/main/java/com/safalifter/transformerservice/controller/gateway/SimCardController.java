package com.safalifter.transformerservice.controller.gateway;

import com.safalifter.transformerservice.enums.SimCardStatus;
import com.safalifter.transformerservice.payload.request.sim.*;
import com.safalifter.transformerservice.payload.response.sim.GatewaySimAssignmentResponse;
import com.safalifter.transformerservice.payload.response.sim.SimCardRevealResponse;
import com.safalifter.transformerservice.payload.response.sim.SimCardResponse;
import com.safalifter.transformerservice.service.SimCardService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@Tag(name = "SIM Card Endpoints")
@RestController
@RequestMapping("/api/v1/sim-cards")
@RequiredArgsConstructor
public class SimCardController {

    private final SimCardService simCardService;

    @GetMapping
    @Operation(summary = "List SIM cards paginated (PIN/PUK masked)")
    @PreAuthorize("hasAuthority('sims.view') OR hasAuthority('READ_PRIVILEGE') OR hasRole('ADMINISTRATOR') OR hasRole('ADMIN')")
    public ResponseEntity<Page<SimCardResponse>> list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String operator,
            @RequestParam(required = false) String search,
            @PageableDefault(size = 25, sort = "id", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        SimCardListFilterRequest filter = new SimCardListFilterRequest();
        if (status != null && !status.isBlank()) {
            try {
                filter.setStatus(SimCardStatus.valueOf(status.trim().toUpperCase()));
            } catch (Exception ignored) {
            }
        }
        filter.setOperator(operator);
        filter.setSearch(search);
        return ResponseEntity.ok(simCardService.findPage(filter, pageable));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get SIM card by id (PIN/PUK masked)")
    @PreAuthorize("hasAuthority('sims.view') OR hasAuthority('READ_PRIVILEGE') OR hasRole('ADMINISTRATOR') OR hasRole('ADMIN')")
    public ResponseEntity<SimCardResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(simCardService.getById(id));
    }

    @PostMapping
    @Operation(summary = "Create SIM card")
    @PreAuthorize("(hasAuthority('sims.create') OR hasAuthority('WRITE_PRIVILEGE') OR hasRole('ADMINISTRATOR') OR hasRole('ADMIN'))")
    public ResponseEntity<SimCardResponse> create(@Valid @RequestBody SimCardCreateRequest request) {
        SimCardResponse saved = simCardService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update SIM card metadata (PIN/PUK not editable via this endpoint)")
    @PreAuthorize("(hasAuthority('sims.edit') OR hasAuthority('UPDATE_PRIVILEGE') OR hasRole('ADMINISTRATOR') OR hasRole('ADMIN'))")
    public ResponseEntity<SimCardResponse> update(@PathVariable Long id, @Valid @RequestBody SimCardUpdateRequest request) {
        return ResponseEntity.ok(simCardService.update(id, request));
    }

    @PostMapping("/{id}/reveal-sensitive")
    @Operation(summary = "Reveal decrypted PIN/PUK once with audit event (requires sims.view_sensitive)")
    @PreAuthorize("hasAuthority('sims.view_sensitive') OR hasRole('ADMINISTRATOR') OR hasRole('ADMIN')")
    public ResponseEntity<SimCardRevealResponse> revealSensitive(
            @PathVariable Long id,
            @Valid @RequestBody SimCardRevealRequest request
    ) {
        return ResponseEntity.ok(simCardService.revealSensitive(id, request));
    }
}
