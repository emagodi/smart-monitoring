package com.safalifter.transformerservice.lifecycle;

import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

/** Installation green light, installations, partner "ready", tentative dates and commissioning (PAT) attempts. */
@RestController
@RequestMapping("/api/v1/lifecycle")
@RequiredArgsConstructor
public class LifecycleController {

    private final LifecycleService service;

    // ---- green light (installation requests)

    @GetMapping("/requests")
    @Operation(summary = "Installation requests (green light from region / depot), scoped to the caller")
    public Map<String, Object> requests(@RequestParam(required = false) String status,
                                        @RequestParam(required = false) String supplierCode,
                                        @RequestParam(required = false) String depotIds,
                                        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                        @RequestParam(required = false) String q,
                                        @RequestParam(defaultValue = "0") int page,
                                        @RequestParam(defaultValue = "10") int size) {
        return service.listRequests(status, supplierCode, ids(depotIds), from, to, q, page, size);
    }

    @GetMapping("/requests/{id}")
    public Map<String, Object> request(@PathVariable long id) {
        return service.getRequest(id);
    }

    @PostMapping("/requests")
    @Operation(summary = "Powertel asks the region / depot for the green light to install on these transformers")
    public ResponseEntity<Map<String, Object>> createRequest(@RequestBody LifecycleService.CreateRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createRequest(body));
    }

    @PostMapping("/requests/{id}/approve")
    public Map<String, Object> approve(@PathVariable long id, @RequestBody(required = false) LifecycleService.Decision body) {
        return service.decideRequest(id, true, body);
    }

    @PostMapping("/requests/{id}/decline")
    public Map<String, Object> decline(@PathVariable long id, @RequestBody LifecycleService.Decision body) {
        return service.decideRequest(id, false, body);
    }

    @PostMapping("/requests/{id}/cancel")
    public Map<String, Object> cancelRequest(@PathVariable long id, @RequestBody(required = false) LifecycleService.Decision body) {
        return service.cancelRequest(id, body);
    }

    // ---- installations

    @GetMapping("/installations")
    @Operation(summary = "Installations with status, partner, dates. dateField = installed | ready | tentative | commissioned")
    public Map<String, Object> installations(@RequestParam(required = false) String status,
                                             @RequestParam(required = false) String supplierCode,
                                             @RequestParam(required = false) String depotIds,
                                             @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                             @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                             @RequestParam(required = false) String dateField,
                                             @RequestParam(required = false) Long requestId,
                                             @RequestParam(required = false) String q,
                                             @RequestParam(defaultValue = "0") int page,
                                             @RequestParam(defaultValue = "10") int size) {
        return service.listInstallations(status, supplierCode, ids(depotIds), from, to, dateField, requestId, q, page, size);
    }

    @GetMapping("/installations/{id}")
    public Map<String, Object> installation(@PathVariable long id) {
        return service.getInstallation(id);
    }

    @PostMapping("/installations")
    @Operation(summary = "Powertel records the transformers installed on a day (status INSTALLED)")
    public ResponseEntity<List<Map<String, Object>>> record(@RequestBody LifecycleService.RecordInstallation body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.recordInstallations(body));
    }

    @PostMapping("/installations/{id}/ready")
    @Operation(summary = "Partner: the site is tested and ready for commissioning")
    public Map<String, Object> ready(@PathVariable long id, @RequestBody(required = false) LifecycleService.StatusNote body) {
        return service.markReady(id, body);
    }

    @PostMapping("/installations/{id}/schedule")
    @Operation(summary = "ZESA group: set / change the tentative commissioning date")
    public Map<String, Object> schedule(@PathVariable long id, @RequestBody LifecycleService.Schedule body) {
        return service.schedule(id, body);
    }

    @PostMapping("/installations/{id}/cancel")
    public Map<String, Object> cancel(@PathVariable long id, @RequestBody LifecycleService.StatusNote body) {
        return service.cancelInstallation(id, body);
    }

    @GetMapping("/transformers/{transformerId}")
    @Operation(summary = "Installation and commissioning history of one transformer")
    public Map<String, Object> transformer(@PathVariable long transformerId) {
        return service.transformerHistory(transformerId);
    }

    // ---- commissioning (PAT form)

    @GetMapping("/commissioning/template")
    public Map<String, Object> template() {
        return service.template();
    }

    @GetMapping("/commissioning")
    @Operation(summary = "All commissioning attempts (report)")
    public Map<String, Object> attempts(@RequestParam(required = false) String result,
                                        @RequestParam(required = false) String supplierCode,
                                        @RequestParam(required = false) String depotIds,
                                        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                        @RequestParam(required = false) String q,
                                        @RequestParam(defaultValue = "0") int page,
                                        @RequestParam(defaultValue = "10") int size) {
        return service.listAttempts(result, supplierCode, ids(depotIds), from, to, q, page, size);
    }

    @PostMapping("/installations/{id}/attempts")
    @Operation(summary = "Open the next commissioning attempt (returns the open draft if there is one)")
    public Map<String, Object> openAttempt(@PathVariable long id) {
        return service.openAttempt(id);
    }

    @GetMapping("/attempts/{attemptId}")
    public Map<String, Object> attempt(@PathVariable long attemptId) {
        return service.getAttempt(attemptId);
    }

    @PutMapping("/attempts/{attemptId}")
    public Map<String, Object> saveAttempt(@PathVariable long attemptId, @RequestBody LifecycleService.AttemptForm body) {
        return service.saveAttempt(attemptId, body);
    }

    @PostMapping("/attempts/{attemptId}/finalise")
    @Operation(summary = "Loss Control: final result PASSED (commissioned) or FAILED")
    public Map<String, Object> finalise(@PathVariable long attemptId, @RequestBody LifecycleService.Finalise body) {
        return service.finaliseAttempt(attemptId, body);
    }

    @DeleteMapping("/attempts/{attemptId}")
    public ResponseEntity<Void> discard(@PathVariable long attemptId) {
        service.deleteDraft(attemptId);
        return ResponseEntity.noContent().build();
    }

    private static List<Long> ids(String csv) {
        if (csv == null || csv.isBlank()) return null;
        return Arrays.stream(csv.split(",")).map(String::trim).filter(s -> s.matches("\\d+")).map(Long::valueOf).toList();
    }
}
