package com.safalifter.transformerservice.service;

import com.safalifter.transformerservice.config.AccessScopeService;
import com.safalifter.transformerservice.entities.GatewaySimAssignment;
import com.safalifter.transformerservice.entities.SimCard;
import com.safalifter.transformerservice.enums.SimCardStatus;
import com.safalifter.transformerservice.payload.request.sim.*;
import com.safalifter.transformerservice.payload.response.sim.*;
import com.safalifter.transformerservice.repository.GatewayRepository;
import com.safalifter.transformerservice.repository.GatewaySimAssignmentRepository;
import com.safalifter.transformerservice.repository.SimCardRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
@Slf4j
public class SimCardService {

    private final SimCardRepository simCardRepository;
    private final GatewaySimAssignmentRepository assignmentRepository;
    private final GatewayRepository gatewayRepository;
    private final AccessScopeService accessScopeService;
    private final SimEncryptionService encryptionService;

    @Transactional(readOnly = true)
    public Page<SimCardResponse> findPage(SimCardListFilterRequest filter, Pageable pageable) {
        forbidSupplier();
        return simCardRepository.findWithFilters(
                filter.getStatus(),
                filter.getOperator(),
                filter.getSearch(),
                pageable
        ).map(this::toMaskedResponse);
    }

    @Transactional(readOnly = true)
    public SimCardResponse getById(Long id) {
        forbidSupplier();
        SimCard sim = simCardRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "SIM Card not found"));
        return toMaskedResponse(sim);
    }

    @Transactional
    public SimCardResponse create(SimCardCreateRequest request) {
        forbidSupplierCrud();
        String normalizedIccid = GatewayStatusService.normalizeIccid(request.getIccid());
        String normalizedImsi = GatewayStatusService.normalizeImsi(request.getImsi());
        if (normalizedIccid != null) {
            simCardRepository.findByNormalizedIccid(normalizedIccid).ifPresent(s -> {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "SIM with this ICCID already exists");
            });
        }
        if (normalizedImsi != null) {
            simCardRepository.findByNormalizedImsi(normalizedImsi).ifPresent(s -> {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "SIM with this IMSI already exists");
            });
        }
        boolean hasSensitive = (request.getPin() != null && !request.getPin().isBlank())
                || (request.getPuk() != null && !request.getPuk().isBlank());
        if (hasSensitive) {
            encryptionService.requireEncryptionKeyForWrite();
        }
        SimCard sim = new SimCard();
        sim.setMsisdn(trimToNull(request.getMsisdn()));
        sim.setIccid(trimToNull(request.getIccid()));
        sim.setNormalizedIccid(normalizedIccid);
        sim.setImsi(trimToNull(request.getImsi()));
        sim.setNormalizedImsi(normalizedImsi);
        sim.setOperator(trimToNull(request.getOperator()));
        sim.setApn(trimToNull(request.getApn()));
        sim.setEncryptedPin(encryptionService.encrypt(trimToNull(request.getPin())));
        sim.setEncryptedPuk(encryptionService.encrypt(trimToNull(request.getPuk())));
        sim.setStatus(request.getStatus() != null ? request.getStatus() : SimCardStatus.AVAILABLE);
        sim.setDataPlanGb(request.getDataPlanGb());
        sim.setAllowanceGb(request.getAllowanceGb());
        sim.setActivationDate(request.getActivationDate());
        sim.setExpiryDate(request.getExpiryDate());
        sim.setNotes(trimToNull(request.getNotes()));
        sim.setCreatedBy(accessScopeService.getCurrentUserEmail());
        SimCard saved = simCardRepository.save(sim);
        log.info("Created SIM id={} iccidTail={} by={}", saved.getId(), last4(saved.getNormalizedIccid()), accessScopeService.getCurrentUserEmail());
        return toMaskedResponse(saved);
    }

    @Transactional
    public SimCardResponse update(Long id, SimCardUpdateRequest request) {
        forbidSupplierCrud();
        SimCard sim = simCardRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "SIM Card not found"));
        sim.setMsisdn(trimToNull(request.getMsisdn()));
        sim.setOperator(trimToNull(request.getOperator()));
        sim.setApn(trimToNull(request.getApn()));
        if (request.getStatus() != null) {
            SimCardStatus prev = sim.getStatus();
            if (request.getStatus() != prev) {
                log.info("SIM id={} status change: {} -> {} by={}", id, prev, request.getStatus(), accessScopeService.getCurrentUserEmail());
            }
            sim.setStatus(request.getStatus());
        }
        sim.setDataPlanGb(request.getDataPlanGb());
        sim.setAllowanceGb(request.getAllowanceGb());
        sim.setActivationDate(request.getActivationDate());
        sim.setExpiryDate(request.getExpiryDate());
        sim.setNotes(trimToNull(request.getNotes()));
        sim.setUpdatedBy(accessScopeService.getCurrentUserEmail());
        SimCard saved = simCardRepository.save(sim);
        return toMaskedResponse(saved);
    }

    @Transactional
    public SimCardRevealResponse revealSensitive(Long id, SimCardRevealRequest request) {
        forbidSupplier();
        requirePermission("sims.view_sensitive");
        SimCard sim = simCardRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "SIM Card not found"));
        String pin = null;
        String puk = null;
        try {
            pin = encryptionService.decrypt(sim.getEncryptedPin());
        } catch (Exception e) {
            log.warn("Failed to decrypt pin for SIM id={}", id, e);
        }
        try {
            puk = encryptionService.decrypt(sim.getEncryptedPuk());
        } catch (Exception e) {
            log.warn("Failed to decrypt puk for SIM id={}", id, e);
        }
        String actor = accessScopeService.getCurrentUserEmail();
        String reason = trimToNull(request.getReason()) != null ? trimToNull(request.getReason()) : "unspecified";
        log.info("AUDIT SIM_REVEAL actor={} simId={} reason={} iccidTail={}",
                actor, id, reason, last4(sim.getNormalizedIccid()));
        return SimCardRevealResponse.builder()
                .id(sim.getId())
                .pin(pin)
                .puk(puk)
                .build();
    }

    @Transactional
    public GatewaySimAssignmentResponse assignSim(Long gatewayId, SimAssignRequest request) {
        forbidSupplierCrud();
        if (gatewayRepository.findById(gatewayId).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Gateway not found");
        }
        SimCard sim = simCardRepository.findById(request.getSimId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "SIM Card not found"));
        Long activeSimCount = assignmentRepository.countActiveBySimId(request.getSimId());
        if (activeSimCount != null && activeSimCount > 0) {
            GatewaySimAssignment active = assignmentRepository.findActiveBySimId(request.getSimId()).orElse(null);
            if (active != null && !Objects.equals(active.getGatewayId(), gatewayId)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "SIM is already active on another gateway");
            }
        }
        GatewaySimAssignment existingActive = assignmentRepository.findActiveByGatewayId(gatewayId).orElse(null);
        if (existingActive != null && Objects.equals(existingActive.getSimId(), request.getSimId())) {
            return toAssignmentResponse(existingActive);
        }
        String actor = accessScopeService.getCurrentUserEmail();
        Instant now = Instant.now();
        if (existingActive != null) {
            existingActive.setActive(false);
            existingActive.setUnassignedAt(now);
            existingActive.setUnassignedBy(actor);
            existingActive.setReason("replaced: " + trimToNull(request.getReason()));
            assignmentRepository.save(existingActive);
        }
        GatewaySimAssignment newAssign = GatewaySimAssignment.builder()
                .gatewayId(gatewayId)
                .simId(request.getSimId())
                .slotNumber(request.getSlotNumber() != null ? request.getSlotNumber() : 1)
                .active(true)
                .assignedAt(now)
                .assignedBy(actor)
                .reason(trimToNull(request.getReason()))
                .notes(trimToNull(request.getNotes()))
                .build();
        GatewaySimAssignment saved = assignmentRepository.save(newAssign);
        sim.setStatus(SimCardStatus.ASSIGNED);
        sim.setUpdatedBy(actor);
        simCardRepository.save(sim);
        log.info("Assigned SIM id={} -> gateway id={} by={}", request.getSimId(), gatewayId, actor);
        return toAssignmentResponse(saved);
    }

    @Transactional
    public GatewaySimAssignmentResponse unassignSim(Long gatewayId, Long assignmentId, SimUnassignRequest request) {
        forbidSupplierCrud();
        GatewaySimAssignment a = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Assignment not found"));
        if (!Objects.equals(a.getGatewayId(), gatewayId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Assignment does not belong to this gateway");
        }
        if (!Boolean.TRUE.equals(a.getActive())) {
            return toAssignmentResponse(a);
        }
        String actor = accessScopeService.getCurrentUserEmail();
        Instant now = Instant.now();
        a.setActive(false);
        a.setUnassignedAt(now);
        a.setUnassignedBy(actor);
        a.setReason(trimToNull(request.getReason()));
        GatewaySimAssignment saved = assignmentRepository.save(a);
        simCardRepository.findById(a.getSimId()).ifPresent(sim -> {
            sim.setStatus(SimCardStatus.AVAILABLE);
            sim.setUpdatedBy(actor);
            simCardRepository.save(sim);
        });
        log.info("Unassigned assignment id={} (simId={} gatewayId={}) by={}", assignmentId, a.getSimId(), gatewayId, actor);
        return toAssignmentResponse(saved);
    }

    @Transactional(readOnly = true)
    public Page<GatewaySimAssignmentResponse> getAssignmentHistory(Long gatewayId, Pageable pageable) {
        forbidSupplier();
        if (gatewayRepository.findById(gatewayId).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Gateway not found");
        }
        return assignmentRepository.findByGatewayIdOrderByAssignedAtDesc(gatewayId, pageable)
                .map(this::toAssignmentResponse);
    }

    private SimCardResponse toMaskedResponse(SimCard sim) {
        return SimCardResponse.builder()
                .id(sim.getId())
                .msisdn(maskMsisdn(sim.getMsisdn()))
                .iccid(maskIccid(sim.getIccid(), sim.getNormalizedIccid()))
                .normalizedIccid(maskIccid(null, sim.getNormalizedIccid()))
                .imsi(maskImsi(sim.getImsi(), sim.getNormalizedImsi()))
                .normalizedImsi(maskImsi(null, sim.getNormalizedImsi()))
                .operator(sim.getOperator())
                .apn(sim.getApn())
                .pin("****")
                .puk("****")
                .status(sim.getStatus() != null ? sim.getStatus().name() : null)
                .dataPlanGb(sim.getDataPlanGb())
                .allowanceGb(sim.getAllowanceGb())
                .activationDate(sim.getActivationDate())
                .expiryDate(sim.getExpiryDate())
                .notes(sim.getNotes())
                .createdBy(sim.getCreatedBy())
                .createdAt(sim.getCreatedAt())
                .updatedBy(sim.getUpdatedBy())
                .updatedAt(sim.getUpdatedAt())
                .build();
    }

    private GatewaySimAssignmentResponse toAssignmentResponse(GatewaySimAssignment a) {
        SimCard sim = simCardRepository.findById(a.getSimId()).orElse(null);
        String maskedMsisdn = sim != null ? maskMsisdn(sim.getMsisdn()) : null;
        String maskedIccid = sim != null ? maskIccid(sim.getIccid(), sim.getNormalizedIccid()) : null;
        return GatewaySimAssignmentResponse.builder()
                .id(a.getId())
                .gatewayId(a.getGatewayId())
                .simId(a.getSimId())
                .slotNumber(a.getSlotNumber())
                .active(Boolean.TRUE.equals(a.getActive()))
                .assignedAt(a.getAssignedAt())
                .unassignedAt(a.getUnassignedAt())
                .assignedBy(a.getAssignedBy())
                .unassignedBy(a.getUnassignedBy())
                .reason(a.getReason())
                .notes(a.getNotes())
                .simMsisdn(maskedMsisdn)
                .simIccid(maskedIccid)
                .build();
    }

    private static String maskMsisdn(String msisdn) {
        if (msisdn == null) return null;
        String t = msisdn.trim();
        if (t.length() <= 4) return "*".repeat(t.length());
        return "*".repeat(t.length() - 4) + t.substring(t.length() - 4);
    }

    private static String maskIccid(String iccid, String normalized) {
        String tail = last4(normalized != null ? normalized : iccid);
        if (tail == null) return null;
        return "************" + tail;
    }

    private static String maskImsi(String imsi, String normalized) {
        String tail = last4(normalized != null ? normalized : imsi);
        if (tail == null) return null;
        return "********" + tail;
    }

    private static String last4(String s) {
        if (s == null || s.isBlank()) return null;
        String t = s.trim();
        return t.length() <= 4 ? t : t.substring(t.length() - 4);
    }

    private void requirePermission(String authority) {
        var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
        boolean has = auth.getAuthorities().stream()
                .anyMatch(g -> authority.equals(g.getAuthority())
                        || ("ROLE_ADMINISTRATOR").equals(g.getAuthority())
                        || ("ROLE_ADMIN").equals(g.getAuthority()));
        if (!has) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Missing permission " + authority);
        }
    }

    private void forbidSupplier() {
        if (accessScopeService.isSupplierScoped()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Supplier users cannot access SIM inventory");
        }
    }

    private void forbidSupplierCrud() {
        if (accessScopeService.isSupplierScoped()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Supplier users cannot create, edit, or assign SIM cards");
        }
    }

    private static String trimToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
