package com.safalifter.transformerservice.controller;

import com.safalifter.transformerservice.payload.response.OculusControlActionResponse;
import com.safalifter.transformerservice.payload.response.OculusTransformerControlResponse;
import com.safalifter.transformerservice.service.OculusControlService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Tag(name = "Oculus Control Endpoints")
@RestController
@RequestMapping("/api/v1/oculus-control")
@RequiredArgsConstructor
public class OculusControlController {

    private final OculusControlService oculusControlService;

    @GetMapping("/transformers")
    @Operation(summary = "List Oculus-monitored transformers for arm/disarm control")
    @PreAuthorize("hasAuthority('READ_PRIVILEGE') and hasAnyRole('ADMIN','DEPOT_FOREMAN','TECHNICIAN','MANAGINGDIRECTOR','DISTRICTMANAGER','FINANCEDIRECTOR','TECHNICALDIRECTOR','COMMERCIALDIRECTOR','BUSINESSMANAGER','USER')")
    public ResponseEntity<List<OculusTransformerControlResponse>> listTransformers() {
        return ResponseEntity.ok(oculusControlService.listTransformers());
    }

    @PostMapping("/transformers/{transformerId}/arm")
    @Operation(summary = "Arm an Oculus-monitored transformer")
    @PreAuthorize("hasAuthority('UPDATE_PRIVILEGE') and hasAnyRole('ADMIN','DEPOT_FOREMAN','TECHNICIAN','MANAGINGDIRECTOR','DISTRICTMANAGER','FINANCEDIRECTOR','TECHNICALDIRECTOR','COMMERCIALDIRECTOR','BUSINESSMANAGER','USER')")
    public ResponseEntity<OculusControlActionResponse> armTransformer(@PathVariable Long transformerId) {
        return ResponseEntity.ok(oculusControlService.armTransformer(transformerId));
    }

    @PostMapping("/transformers/{transformerId}/disarm")
    @Operation(summary = "Disarm an Oculus-monitored transformer")
    @PreAuthorize("hasAuthority('UPDATE_PRIVILEGE') and hasAnyRole('ADMIN','DEPOT_FOREMAN','TECHNICIAN','MANAGINGDIRECTOR','DISTRICTMANAGER','FINANCEDIRECTOR','TECHNICALDIRECTOR','COMMERCIALDIRECTOR','BUSINESSMANAGER','USER')")
    public ResponseEntity<OculusControlActionResponse> disarmTransformer(@PathVariable Long transformerId) {
        return ResponseEntity.ok(oculusControlService.disarmTransformer(transformerId));
    }
}
