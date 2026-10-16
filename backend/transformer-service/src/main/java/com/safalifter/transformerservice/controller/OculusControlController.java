package com.safalifter.transformerservice.controller;

import com.safalifter.transformerservice.config.AccessScopeService;
import com.safalifter.transformerservice.payload.request.AlertCaseUpdateRequest;
import com.safalifter.transformerservice.payload.response.OculusControlActionResponse;
import com.safalifter.transformerservice.service.AlertService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.server.ResponseStatusException;
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
    private final AccessScopeService accessScopeService;
    private final AlertService alertService;

    @GetMapping("/transformers")
    @Operation(summary = "List Oculus-monitored transformers for arm/disarm control")
    public ResponseEntity<List<OculusTransformerControlResponse>> listTransformers() {
        return ResponseEntity.ok(oculusControlService.listTransformers());
    }

    @PostMapping("/transformers/{transformerId}/arm")
    @Operation(summary = "Arm an Oculus-monitored transformer (permission control.arm). Pass alertId to log it on that incident.")
    public ResponseEntity<OculusControlActionResponse> armTransformer(@PathVariable Long transformerId,
                                                                      @RequestParam(required = false) Long alertId) {
        require("control.arm");
        OculusControlActionResponse response = oculusControlService.armTransformer(transformerId);
        logOnIncident(alertId, "Transformer ARM command sent (" + response.getCommandStatus() + ")");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/transformers/{transformerId}/disarm")
    @Operation(summary = "Disarm an Oculus-monitored transformer (permission control.disarm). Pass alertId to log it on that incident.")
    public ResponseEntity<OculusControlActionResponse> disarmTransformer(@PathVariable Long transformerId,
                                                                         @RequestParam(required = false) Long alertId) {
        require("control.disarm");
        OculusControlActionResponse response = oculusControlService.disarmTransformer(transformerId);
        logOnIncident(alertId, "Transformer DISARM command sent (" + response.getCommandStatus() + ")");
        return ResponseEntity.ok(response);
    }

    /** Same rule as WhatsApp chat commands: the tick-box permission (or Administrator). */
    private void require(String permission) {
        if (!accessScopeService.hasPermission(permission)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Missing permission: " + permission);
        }
    }

    private void logOnIncident(Long alertId, String note) {
        if (alertId == null) return;
        try {
            AlertCaseUpdateRequest request = new AlertCaseUpdateRequest();
            request.setNote(note);
            alertService.updateCase(alertId, request);
        } catch (Exception ignored) {
            // the command itself succeeded; the incident note is best-effort
        }
    }
}
