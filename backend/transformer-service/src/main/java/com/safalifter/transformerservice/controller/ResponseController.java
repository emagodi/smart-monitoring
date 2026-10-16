package com.safalifter.transformerservice.controller;

import com.safalifter.transformerservice.payload.request.response.CaseNoteRequest;
import com.safalifter.transformerservice.payload.request.response.CloseIncidentRequest;
import com.safalifter.transformerservice.payload.request.response.DispatchRequest;
import com.safalifter.transformerservice.payload.request.response.DispatchStatusRequest;
import com.safalifter.transformerservice.payload.request.response.VehicleRequest;
import com.safalifter.transformerservice.payload.response.AlertResponse;
import com.safalifter.transformerservice.payload.response.response.DispatchResponse;
import com.safalifter.transformerservice.payload.response.response.ResponseBoardResponse;
import com.safalifter.transformerservice.payload.response.response.VehicleResponse;
import com.safalifter.transformerservice.service.ResponseService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Incident response workflow (contact centre / dispatch). Fine-grained permission checks
 * (response.acknowledge, response.dispatch, response.close, fleet.update) live in ResponseService.
 */
@Tag(name = "Incident Response")
@RestController
@RequestMapping("/api/v1/response")
@RequiredArgsConstructor
public class ResponseController {

    private final ResponseService responseService;

    @GetMapping("/board")
    @Operation(summary = "Open incidents with their dispatches, plus incidents closed in the last 24h")
    public ResponseEntity<ResponseBoardResponse> board() {
        return ResponseEntity.ok(responseService.board());
    }

    @GetMapping("/cases/{alertId}/dispatches")
    public ResponseEntity<List<DispatchResponse>> dispatches(@PathVariable Long alertId) {
        return ResponseEntity.ok(responseService.dispatchesForAlert(alertId));
    }

    @PostMapping("/cases/{alertId}/acknowledge")
    @Operation(summary = "Contact centre acknowledges the alert")
    public ResponseEntity<AlertResponse> acknowledge(@PathVariable Long alertId, @RequestBody(required = false) CaseNoteRequest request) {
        return ResponseEntity.ok(responseService.acknowledge(alertId, request != null ? request.getNote() : null));
    }

    @PostMapping("/cases/{alertId}/dispatch")
    @Operation(summary = "Send a response vehicle; the crew lead gets an SMS/WhatsApp/email link")
    public ResponseEntity<DispatchResponse> dispatch(@PathVariable Long alertId, @RequestBody DispatchRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(responseService.dispatch(alertId, request));
    }

    @PostMapping("/dispatches/{dispatchId}/status")
    @Operation(summary = "Record crew progress on behalf of the crew (ACCEPTED, ON_SCENE) or recall (CANCELLED)")
    public ResponseEntity<DispatchResponse> updateDispatch(@PathVariable Long dispatchId, @RequestBody DispatchStatusRequest request) {
        return ResponseEntity.ok(responseService.updateDispatch(dispatchId, request));
    }

    @PostMapping("/cases/{alertId}/close")
    @Operation(summary = "Close the incident with an outcome (REAL_THREAT, FALSE_ALARM, TECHNICAL_FAULT, AUTHORISED_ACTIVITY, OTHER)")
    public ResponseEntity<AlertResponse> close(@PathVariable Long alertId, @RequestBody CloseIncidentRequest request) {
        return ResponseEntity.ok(responseService.close(alertId, request));
    }

    @GetMapping("/vehicles")
    public ResponseEntity<List<VehicleResponse>> vehicles() {
        return ResponseEntity.ok(responseService.vehicles());
    }

    @PostMapping("/vehicles")
    public ResponseEntity<VehicleResponse> createVehicle(@RequestBody VehicleRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(responseService.saveVehicle(null, request));
    }

    @PutMapping("/vehicles/{id}")
    public ResponseEntity<VehicleResponse> updateVehicle(@PathVariable Long id, @RequestBody VehicleRequest request) {
        return ResponseEntity.ok(responseService.saveVehicle(id, request));
    }

    @DeleteMapping("/vehicles/{id}")
    public ResponseEntity<Void> deleteVehicle(@PathVariable Long id) {
        responseService.deleteVehicle(id);
        return ResponseEntity.noContent().build();
    }
}
