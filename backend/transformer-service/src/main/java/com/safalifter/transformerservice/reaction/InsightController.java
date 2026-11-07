package com.safalifter.transformerservice.reaction;

import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

/** Fault alarms and alarm analytics (heat maps, false alarms, per partner). */
@RestController
@RequiredArgsConstructor
public class InsightController {

    private final FaultService faultService;
    private final AnalyticsService analyticsService;

    @GetMapping("/api/v1/faults")
    public Map<String, Object> faults(@RequestParam(required = false) String status,
                                      @RequestParam(required = false) Long transformerId,
                                      @RequestParam(required = false) String supplierCode,
                                      @RequestParam(required = false) String depotIds,
                                      @RequestParam(required = false) String type,
                                      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                      @RequestParam(required = false) String q,
                                      @RequestParam(defaultValue = "0") int page,
                                      @RequestParam(defaultValue = "10") int size) {
        return faultService.list(status, transformerId, supplierCode, ids(depotIds), type, from, to, q, page, size);
    }

    @GetMapping("/api/v1/faults/open-by-transformer")
    public Map<Long, Long> openByTransformer() {
        return faultService.openByTransformer();
    }

    @PostMapping("/api/v1/faults")
    @Operation(summary = "Raise a fault alarm on a transformer (equipment fault, not an intrusion)")
    public ResponseEntity<Map<String, Object>> raise(@RequestBody FaultService.Raise body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(faultService.raise(body));
    }

    @PostMapping("/api/v1/faults/{id}/resolve")
    public Map<String, Object> resolve(@PathVariable long id, @RequestBody(required = false) FaultService.Resolve body) {
        return faultService.resolve(id, body);
    }

    @GetMapping("/api/v1/analytics/alerts")
    @Operation(summary = "Alerts per transformer (heat map), per partner, per depot, per day; outcomes and reaction times")
    public Map<String, Object> alerts(@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                      @RequestParam(required = false) String depotIds,
                                      @RequestParam(required = false) String supplierCode,
                                      @RequestParam(required = false) String outcome) {
        return analyticsService.alerts(from, to, ids(depotIds), supplierCode, outcome);
    }

    private static List<Long> ids(String csv) {
        if (csv == null || csv.isBlank()) return null;
        return Arrays.stream(csv.split(",")).map(String::trim).filter(s -> s.matches("\\d+")).map(Long::valueOf).toList();
    }
}
