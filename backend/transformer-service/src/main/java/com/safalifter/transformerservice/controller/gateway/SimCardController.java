package com.safalifter.transformerservice.controller.gateway;

import com.safalifter.transformerservice.enums.SimCardStatus;
import com.safalifter.transformerservice.payload.request.sim.*;
import com.safalifter.transformerservice.payload.response.sim.GatewaySimAssignmentResponse;
import com.safalifter.transformerservice.payload.response.sim.SimCardRevealResponse;
import com.safalifter.transformerservice.payload.response.sim.SimCardResponse;
import com.safalifter.transformerservice.payload.response.sim.SimImportResponse;
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
            @RequestParam(required = false) String networkState,
            @RequestParam(required = false) String condition,
            @RequestParam(required = false) String operator,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Boolean hasPin,
            @RequestParam(required = false) Boolean hasPuk,
            @RequestParam(required = false) Boolean assigned,
            @PageableDefault(size = 25, sort = "id", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        SimCardListFilterRequest filter = buildFilter(status, networkState, condition, operator, search, hasPin, hasPuk, assigned);
        return ResponseEntity.ok(simCardService.findPage(filter, pageable));
    }

    @GetMapping("/summary")
    @Operation(summary = "Inventory counts: tiles plus per-filter-group counts (with the other filters applied)")
    @PreAuthorize("hasAuthority('sims.view') OR hasAuthority('READ_PRIVILEGE') OR hasRole('ADMINISTRATOR') OR hasRole('ADMIN')")
    public ResponseEntity<java.util.Map<String, Object>> summary(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String networkState,
            @RequestParam(required = false) String condition,
            @RequestParam(required = false) String operator,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Boolean hasPin,
            @RequestParam(required = false) Boolean hasPuk
    ) {
        return ResponseEntity.ok(simCardService.summary(buildFilter(status, networkState, condition, operator, search, hasPin, hasPuk, null)));
    }

    private static SimCardListFilterRequest buildFilter(String status, String networkState, String condition, String operator, String search,
                                                        Boolean hasPin, Boolean hasPuk, Boolean assigned) {
        SimCardListFilterRequest filter = new SimCardListFilterRequest();
        filter.setStatus(parse(SimCardStatus.class, status));
        filter.setNetworkState(parse(com.safalifter.transformerservice.enums.SimNetworkState.class, networkState));
        filter.setCondition(parse(com.safalifter.transformerservice.enums.SimCondition.class, condition));
        filter.setOperator(operator);
        filter.setSearch(search);
        filter.setHasPin(hasPin);
        filter.setHasPuk(hasPuk);
        filter.setAssigned(assigned);
        return filter;
    }

    private static <E extends Enum<E>> E parse(Class<E> type, String v) {
        if (v == null || v.isBlank()) return null;
        try {
            return Enum.valueOf(type, v.trim().toUpperCase());
        } catch (Exception e) {
            return null;
        }
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

    @DeleteMapping("/{id}")
    @Operation(summary = "Retire (soft-delete) SIM card by setting status to RETIRED")
    @PreAuthorize("(hasAuthority('sims.edit') OR hasAuthority('DELETE_PRIVILEGE') OR hasRole('ADMINISTRATOR') OR hasRole('ADMIN'))")
    public ResponseEntity<Void> retire(@PathVariable Long id) {
        simCardService.retire(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/import")
    @Operation(summary = "Bulk load SIM inventory from an operator spreadsheet (rows parsed client-side; PIN/PUK not included)")
    @PreAuthorize("(hasAuthority('sims.create') OR hasAuthority('WRITE_PRIVILEGE') OR hasRole('ADMINISTRATOR') OR hasRole('ADMIN'))")
    public ResponseEntity<SimImportResponse> importSims(@RequestBody SimImportRequest request) {
        return ResponseEntity.ok(simCardService.importSims(request));
    }

    @GetMapping("/available")
    @Operation(summary = "List available (unassigned, status AVAILABLE) SIM cards for assign dropdown")
    @PreAuthorize("hasAuthority('sims.view') OR hasAuthority('READ_PRIVILEGE') OR hasRole('ADMINISTRATOR') OR hasRole('ADMIN')")
    public ResponseEntity<Page<SimCardResponse>> listAvailable(
            @PageableDefault(size = 100, sort = "id", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        return ResponseEntity.ok(simCardService.findAvailable(pageable));
    }

    @PostMapping("/{id}/unassign")
    @Operation(summary = "Unassign a SIM card from any gateway it is currently assigned to (SIM-centric unassign)")
    @PreAuthorize("(hasAuthority('sims.unassign') OR hasAuthority('sims.edit') OR hasAuthority('WRITE_PRIVILEGE') OR hasRole('ADMINISTRATOR') OR hasRole('ADMIN'))")
    public ResponseEntity<GatewaySimAssignmentResponse> unassignBySimId(
            @PathVariable Long id,
            @RequestBody(required = false) SimUnassignRequest request
    ) {
        return ResponseEntity.ok(simCardService.unassignBySimId(id, request));
    }
}
