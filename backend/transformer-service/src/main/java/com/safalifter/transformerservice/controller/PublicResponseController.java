package com.safalifter.transformerservice.controller;

import com.safalifter.transformerservice.payload.request.response.CaseNoteRequest;
import com.safalifter.transformerservice.payload.request.response.CloseIncidentRequest;
import com.safalifter.transformerservice.payload.response.response.CrewIncidentView;
import com.safalifter.transformerservice.service.ResponseService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Crew-facing endpoints behind the link sent at dispatch. No login: the path token
 * (192 random bits, one per dispatch) is the credential, and it only exposes that one job.
 */
@Tag(name = "Crew Response Link")
@RestController
@RequestMapping("/api/v1/public/response")
@RequiredArgsConstructor
public class PublicResponseController {

    private final ResponseService responseService;

    @GetMapping("/{token}")
    public ResponseEntity<CrewIncidentView> view(@PathVariable String token) {
        return ResponseEntity.ok(responseService.crewView(token));
    }

    @PostMapping("/{token}/accept")
    public ResponseEntity<CrewIncidentView> accept(@PathVariable String token, @RequestBody(required = false) CaseNoteRequest request) {
        return ResponseEntity.ok(responseService.crewAction(token, "accept", null, request != null ? request.getNote() : null));
    }

    @PostMapping("/{token}/arrive")
    public ResponseEntity<CrewIncidentView> arrive(@PathVariable String token, @RequestBody(required = false) CaseNoteRequest request) {
        return ResponseEntity.ok(responseService.crewAction(token, "arrive", null, request != null ? request.getNote() : null));
    }

    @PostMapping("/{token}/close")
    public ResponseEntity<CrewIncidentView> close(@PathVariable String token, @RequestBody CloseIncidentRequest request) {
        return ResponseEntity.ok(responseService.crewAction(token, "close", request, null));
    }
}
