package com.safalifter.transformerservice.service;

import com.safalifter.transformerservice.config.AccessScopeService;
import com.safalifter.transformerservice.entities.GatewaySimAssignment;
import com.safalifter.transformerservice.entities.SimCard;
import com.safalifter.transformerservice.enums.SimCardStatus;
import com.safalifter.transformerservice.enums.SimCondition;
import com.safalifter.transformerservice.enums.SimNetworkState;
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
                filter.getNetworkState(),
                filter.getCondition(),
                filter.getOperator(),
                filter.getHasPin(),
                filter.getHasPuk(),
                filter.getAssigned(),
                filter.getSearch(),
                pageable
        ).map(this::toMaskedResponse);
    }

    /**
     * Counts for the SIM page. "facets" are the counts for each filter group (placement, network state, condition,
     * PIN, PUK) with every OTHER active filter applied, so the chips show how many you would get by clicking them
     * (e.g. Assigned + Active). The other numbers are whole-inventory totals for the tiles.
     */
    @Transactional(readOnly = true)
    public java.util.Map<String, Object> summary(SimCardListFilterRequest f) {
        forbidSupplier();
        SimCardListFilterRequest filter = f == null ? new SimCardListFilterRequest() : f;
        java.util.Set<Long> inGatewayIds = new java.util.HashSet<>(simCardRepository.simIdsInGateway());
        List<SimCard> all = simCardRepository.findAll();
        String term = filter.getSearch() == null ? "" : filter.getSearch().trim().toLowerCase(java.util.Locale.ROOT);
        String op = filter.getOperator() == null ? "" : filter.getOperator().trim().toLowerCase(java.util.Locale.ROOT);

        java.util.Map<String, Long> placement = zeros("AVAILABLE", "ASSIGNED", "RETIRED");
        java.util.Map<String, Long> network = zeros(java.util.Arrays.stream(SimNetworkState.values()).map(Enum::name).toArray(String[]::new));
        java.util.Map<String, Long> condition = zeros(java.util.Arrays.stream(SimCondition.values()).map(Enum::name).toArray(String[]::new));
        java.util.Map<String, Long> pin = zeros("yes", "no");
        java.util.Map<String, Long> puk = zeros("yes", "no");
        long total = 0, inGateway = 0, spare = 0, retired = 0, activeNet = 0, withPin = 0, withPuk = 0, attention = 0;
        java.util.TreeSet<String> operators = new java.util.TreeSet<>();

        for (SimCard s : all) {
            String pl = placementOf(s, inGatewayIds);
            SimNetworkState ns = s.getNetworkState() != null ? s.getNetworkState() : SimNetworkState.ACTIVE;
            SimCondition cd = s.getCondition() != null ? s.getCondition() : SimCondition.OK;
            boolean hp = s.getEncryptedPin() != null && !s.getEncryptedPin().isBlank();
            boolean hk = s.getEncryptedPuk() != null && !s.getEncryptedPuk().isBlank();
            if (s.getOperator() != null && !s.getOperator().isBlank()) operators.add(s.getOperator());

            total++;
            if ("ASSIGNED".equals(pl)) inGateway++;
            else if ("RETIRED".equals(pl)) retired++;
            else spare++;
            if (!"RETIRED".equals(pl)) {
                if (ns == SimNetworkState.ACTIVE) activeNet++;
                if (cd != SimCondition.OK || ns == SimNetworkState.SUSPENDED || ns == SimNetworkState.EXPIRED) attention++;
            }
            if (hp) withPin++;
            if (hk) withPuk++;

            // Shared filters (search / operator) apply to every facet.
            if (!op.isEmpty() && (s.getOperator() == null || !s.getOperator().toLowerCase(java.util.Locale.ROOT).contains(op))) continue;
            if (!term.isEmpty() && !matches(s, term)) continue;
            boolean okPl = filter.getStatus() == null || filter.getStatus().name().equals(pl);
            boolean okNs = filter.getNetworkState() == null || filter.getNetworkState() == ns;
            boolean okCd = filter.getCondition() == null || filter.getCondition() == cd;
            boolean okPin = filter.getHasPin() == null || filter.getHasPin() == hp;
            boolean okPuk = filter.getHasPuk() == null || filter.getHasPuk() == hk;
            if (okNs && okCd && okPin && okPuk) placement.merge(pl, 1L, Long::sum);
            if (okPl && okCd && okPin && okPuk) network.merge(ns.name(), 1L, Long::sum);
            if (okPl && okNs && okPin && okPuk) condition.merge(cd.name(), 1L, Long::sum);
            if (okPl && okNs && okCd && okPuk) pin.merge(hp ? "yes" : "no", 1L, Long::sum);
            if (okPl && okNs && okCd && okPin) puk.merge(hk ? "yes" : "no", 1L, Long::sum);
        }

        java.util.Map<String, Object> facets = new java.util.LinkedHashMap<>();
        facets.put("placement", placement);
        facets.put("networkState", network);
        facets.put("condition", condition);
        facets.put("pin", pin);
        facets.put("puk", puk);
        java.util.Map<String, Object> out = new java.util.LinkedHashMap<>();
        out.put("total", total);
        out.put("inGateway", inGateway);
        out.put("spare", spare);
        out.put("retired", retired);
        out.put("activeOnNetwork", activeNet);
        out.put("withPin", withPin);
        out.put("withoutPin", Math.max(0, total - withPin));
        out.put("withPuk", withPuk);
        out.put("withoutPuk", Math.max(0, total - withPuk));
        out.put("attention", attention);
        out.put("facets", facets);
        out.put("operators", new java.util.ArrayList<>(operators));
        return out;
    }

    private static java.util.Map<String, Long> zeros(String... keys) {
        java.util.Map<String, Long> m = new java.util.LinkedHashMap<>();
        for (String k : keys) m.put(k, 0L);
        return m;
    }

    private static String placementOf(SimCard s, java.util.Set<Long> inGatewayIds) {
        if (s.getStatus() == SimCardStatus.RETIRED) return "RETIRED";
        return inGatewayIds.contains(s.getId()) ? "ASSIGNED" : "AVAILABLE";
    }

    private static boolean matches(SimCard s, String term) {
        for (String v : new String[]{s.getMsisdn(), s.getIccid(), s.getNormalizedIccid(), s.getImsi(), s.getNormalizedImsi(), s.getOperator()}) {
            if (v != null && v.toLowerCase(java.util.Locale.ROOT).contains(term)) return true;
        }
        return false;
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
        boolean hasSensitive = (request.getPin() != null && !request.getPin().isBlank())
                || (request.getPuk() != null && !request.getPuk().isBlank())
                || (request.getPin2() != null && !request.getPin2().isBlank())
                || (request.getPuk2() != null && !request.getPuk2().isBlank());
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
        sim.setNetworkName(trimToNull(request.getNetworkName()));
        sim.setApn(trimToNull(request.getApn()));
        sim.setEncryptedPin(encryptionService.encrypt(trimToNull(request.getPin())));
        sim.setEncryptedPuk(encryptionService.encrypt(trimToNull(request.getPuk())));
        sim.setEncryptedPin2(encryptionService.encrypt(trimToNull(request.getPin2())));
        sim.setEncryptedPuk2(encryptionService.encrypt(trimToNull(request.getPuk2())));
        sim.setKi(trimToNull(request.getKi()));
        sim.setOpc(trimToNull(request.getOpc()));
        sim.setCardSerialNumber(trimToNull(request.getCardSerialNumber()));
        // Placement starts as spare stock (or retired); "in a gateway" only comes from an assignment.
        sim.setStatus(request.getStatus() == SimCardStatus.RETIRED ? SimCardStatus.RETIRED : SimCardStatus.AVAILABLE);
        sim.setNetworkState(request.getNetworkState() != null ? request.getNetworkState() : SimNetworkState.ACTIVE);
        sim.setCondition(request.getCondition() != null ? request.getCondition() : SimCondition.OK);
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
        if (trimToNull(request.getIccid()) != null && !looksLikeMask(request.getIccid())) {
            String v = trimToNull(request.getIccid());
            sim.setIccid(v);
            sim.setNormalizedIccid(GatewayStatusService.normalizeIccid(v));
        }
        if (trimToNull(request.getImsi()) != null && !looksLikeMask(request.getImsi())) {
            String v = trimToNull(request.getImsi());
            sim.setImsi(v);
            sim.setNormalizedImsi(GatewayStatusService.normalizeImsi(v));
        }
        if (trimToNull(request.getMsisdn()) != null && !looksLikeMask(request.getMsisdn())) {
            String v = trimToNull(request.getMsisdn());
            sim.setMsisdn(v);
        }
        if (trimToNull(request.getCardSerialNumber()) != null && !looksLikeMask(request.getCardSerialNumber())) {
            sim.setCardSerialNumber(trimToNull(request.getCardSerialNumber()));
        }
        if (request.getOperator() != null) {
            sim.setOperator(trimToNull(request.getOperator()));
        }
        if (request.getNetworkName() != null) {
            sim.setNetworkName(trimToNull(request.getNetworkName()));
        }
        if (request.getApn() != null) {
            sim.setApn(trimToNull(request.getApn()));
        }
        boolean hasSensitive = false;
        if (!looksLikeMask(request.getPin()) && trimToNull(request.getPin()) != null) {
            sim.setEncryptedPin(encryptionService.encrypt(trimToNull(request.getPin())));
            hasSensitive = true;
        }
        if (!looksLikeMask(request.getPuk()) && trimToNull(request.getPuk()) != null) {
            sim.setEncryptedPuk(encryptionService.encrypt(trimToNull(request.getPuk())));
            hasSensitive = true;
        }
        if (!looksLikeMask(request.getPin2()) && trimToNull(request.getPin2()) != null) {
            sim.setEncryptedPin2(encryptionService.encrypt(trimToNull(request.getPin2())));
            hasSensitive = true;
        }
        if (!looksLikeMask(request.getPuk2()) && trimToNull(request.getPuk2()) != null) {
            sim.setEncryptedPuk2(encryptionService.encrypt(trimToNull(request.getPuk2())));
            hasSensitive = true;
        }
        if (hasSensitive) {
            encryptionService.requireEncryptionKeyForWrite();
        }
        if (trimToNull(request.getKi()) != null && !looksLikeMask(request.getKi())) {
            sim.setKi(trimToNull(request.getKi()));
        }
        if (trimToNull(request.getOpc()) != null && !looksLikeMask(request.getOpc())) {
            sim.setOpc(trimToNull(request.getOpc()));
        }
        // Placement: only "retired" / "back in stock" can be chosen here; "in a gateway" follows the assignment.
        if (request.getStatus() != null) {
            boolean inGateway = assignmentRepository.findActiveBySimId(sim.getId()).isPresent();
            SimCardStatus next = request.getStatus() == SimCardStatus.RETIRED ? SimCardStatus.RETIRED
                    : inGateway ? SimCardStatus.ASSIGNED : SimCardStatus.AVAILABLE;
            if (next == SimCardStatus.RETIRED && inGateway) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Remove the SIM from its gateway before retiring it");
            }
            if (next != sim.getStatus()) {
                log.info("SIM id={} placement {} -> {} by={}", id, sim.getStatus(), next, accessScopeService.getCurrentUserEmail());
                sim.setStatus(next);
            }
        }
        if (request.getNetworkState() != null) sim.setNetworkState(request.getNetworkState());
        if (request.getCondition() != null) sim.setCondition(request.getCondition());
        sim.setDataPlanGb(request.getDataPlanGb());
        sim.setAllowanceGb(request.getAllowanceGb());
        sim.setActivationDate(request.getActivationDate());
        sim.setExpiryDate(request.getExpiryDate());
        if (request.getNotes() != null) {
            sim.setNotes(trimToNull(request.getNotes()));
        }
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
        String pin2 = null;
        String puk2 = null;
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
        try {
            pin2 = encryptionService.decrypt(sim.getEncryptedPin2());
        } catch (Exception e) {
            log.warn("Failed to decrypt pin2 for SIM id={}", id, e);
        }
        try {
            puk2 = encryptionService.decrypt(sim.getEncryptedPuk2());
        } catch (Exception e) {
            log.warn("Failed to decrypt puk2 for SIM id={}", id, e);
        }
        String actor = accessScopeService.getCurrentUserEmail();
        String reason = trimToNull(request.getReason()) != null ? trimToNull(request.getReason()) : "unspecified";
        log.info("AUDIT SIM_REVEAL actor={} simId={} reason={} iccidTail={}",
                actor, id, reason, last4(sim.getNormalizedIccid()));
        return SimCardRevealResponse.builder()
                .id(sim.getId())
                .iccid(sim.getNormalizedIccid())
                .imsi(sim.getImsi())
                .msisdn(sim.getMsisdn())
                .pin(pin)
                .puk(puk)
                .pin2(pin2)
                .puk2(puk2)
                .build();
    }

    @Transactional
    public void retire(Long id) {
        forbidSupplierCrud();
        SimCard sim = simCardRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "SIM Card not found"));
        if (assignmentRepository.findActiveBySimId(id).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Remove the SIM from its gateway before retiring it");
        }
        sim.setStatus(SimCardStatus.RETIRED);
        sim.setUpdatedBy(accessScopeService.getCurrentUserEmail());
        simCardRepository.save(sim);
        log.info("Retired SIM id={} iccidTail={} by={}", id, last4(sim.getNormalizedIccid()), accessScopeService.getCurrentUserEmail());
    }

    @Transactional(readOnly = true)
    public Page<SimCardResponse> findAvailable(Pageable pageable) {
        forbidSupplier();
        return simCardRepository.findAvailable(pageable).map(this::toMaskedResponse);
    }

    @Transactional
    public GatewaySimAssignmentResponse assignSim(Long gatewayId, SimAssignRequest request) {
        forbidSupplierCrud();
        if (gatewayRepository.findById(gatewayId).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Gateway not found");
        }
        SimCard sim = simCardRepository.findById(request.getSimId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "SIM Card not found"));
        if (sim.getStatus() == SimCardStatus.RETIRED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This SIM is retired. Bring it back into stock (Edit) before assigning it.");
        }
        if (sim.getCondition() == SimCondition.LOST || sim.getCondition() == SimCondition.DAMAGED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This SIM is marked " + sim.getCondition().name().toLowerCase() + " and cannot go into a gateway.");
        }
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
        String pin = trimToNull(request.getPin());
        String puk = trimToNull(request.getPuk());
        if ((pin != null && !looksLikeMask(pin)) || (puk != null && !looksLikeMask(puk))) {
            encryptionService.requireEncryptionKeyForWrite();
            if (pin != null && !looksLikeMask(pin)) sim.setEncryptedPin(encryptionService.encrypt(pin));
            if (puk != null && !looksLikeMask(puk)) sim.setEncryptedPuk(encryptionService.encrypt(puk));
            log.info("SIM id={} PIN/PUK captured at assignment by={}", sim.getId(), actor);
        }
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

    @Transactional
    public GatewaySimAssignmentResponse unassignBySimId(Long simId, SimUnassignRequest request) {
        forbidSupplierCrud();
        GatewaySimAssignment a = assignmentRepository.findActiveBySimId(simId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No active assignment found for this SIM"));
        String actor = accessScopeService.getCurrentUserEmail();
        Instant now = Instant.now();
        a.setActive(false);
        a.setUnassignedAt(now);
        a.setUnassignedBy(actor);
        a.setReason(request != null ? trimToNull(request.getReason()) : a.getReason());
        GatewaySimAssignment saved = assignmentRepository.save(a);
        simCardRepository.findById(a.getSimId()).ifPresent(sim -> {
            sim.setStatus(SimCardStatus.AVAILABLE);
            sim.setUpdatedBy(actor);
            simCardRepository.save(sim);
        });
        log.info("Unassigned (SIM-based) assignment id={} (simId={} gatewayId={}) by={}", saved.getId(), simId, saved.getGatewayId(), actor);
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
        GatewaySimAssignment active = assignmentRepository.findActiveBySimId(sim.getId()).orElse(null);
        String assignedGatewayName = null;
        if (active != null && active.getGatewayId() != null) {
            assignedGatewayName = gatewayRepository.findById(active.getGatewayId())
                    .map(g -> g.getName() != null ? g.getName() : "Gateway #" + active.getGatewayId())
                    .orElse("Gateway #" + active.getGatewayId());
        }
        return SimCardResponse.builder()
                .id(sim.getId())
                .msisdn(maskMsisdn(sim.getMsisdn()))
                .iccid(maskIccid(sim.getIccid(), sim.getNormalizedIccid()))
                .normalizedIccid(maskIccid(null, sim.getNormalizedIccid()))
                .imsi(maskImsi(sim.getImsi(), sim.getNormalizedImsi()))
                .normalizedImsi(maskImsi(null, sim.getNormalizedImsi()))
                .operator(sim.getOperator())
                .networkName(sim.getNetworkName())
                .apn(sim.getApn())
                .pin("****")
                .puk("****")
                .pin2("****")
                .puk2("****")
                .hasPin(sim.getEncryptedPin() != null && !sim.getEncryptedPin().isBlank())
                .hasPuk(sim.getEncryptedPuk() != null && !sim.getEncryptedPuk().isBlank())
                .ki(maskTail(sim.getKi()))
                .opc(maskTail(sim.getOpc()))
                .cardSerialNumber(maskTail(sim.getCardSerialNumber()))
                .status(sim.getStatus() != null ? sim.getStatus().name() : null)
                .networkState((sim.getNetworkState() != null ? sim.getNetworkState() : SimNetworkState.ACTIVE).name())
                .condition((sim.getCondition() != null ? sim.getCondition() : SimCondition.OK).name())
                .assignedGatewayId(active != null ? active.getGatewayId() : null)
                .assignedGatewayName(assignedGatewayName)
                .slotNumber(active != null ? active.getSlotNumber() : null)
                .assignedAt(active != null ? active.getAssignedAt() : null)
                .unassignedAt(active != null ? active.getUnassignedAt() : null)
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
        String assignmentStatus = Boolean.TRUE.equals(a.getActive()) ? "ACTIVE" : "UNASSIGNED";
        return GatewaySimAssignmentResponse.builder()
                .id(a.getId())
                .gatewayId(a.getGatewayId())
                .simId(a.getSimId())
                .slotNumber(a.getSlotNumber())
                .active(Boolean.TRUE.equals(a.getActive()))
                .status(assignmentStatus)
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

    public static String maskIccid(String iccid, String normalized) {
        // Prefer actual iccid column value for last-4 suffix to avoid stale-normalized drift; fallback to normalized only when iccid empty
        String source = (iccid != null && !iccid.isBlank()) ? iccid : normalized;
        String tail = last4(source);
        if (tail == null) return null;
        return "************" + tail;
    }

    private static String maskImsi(String imsi, String normalized) {
        // Prefer actual imsi column value for last-4 suffix; fallback to normalized only when imsi empty
        String source = (imsi != null && !imsi.isBlank()) ? imsi : normalized;
        String tail = last4(source);
        if (tail == null) return null;
        return "********" + tail;
    }

    private static String last4(String s) {
        if (s == null || s.isBlank()) return null;
        String t = s.trim();
        return t.length() <= 4 ? t : t.substring(t.length() - 4);
    }

    private static String maskTail(String s) {
        if (s == null || s.isBlank()) return null;
        String t = s.trim();
        if (t.length() <= 4) return "*".repeat(t.length());
        return "*".repeat(t.length() - 4) + t.substring(t.length() - 4);
    }

    // ------------------------------------------------------------------ bulk import

    /**
     * Load SIMs from an operator spreadsheet. Matches on ICCID: new ICCIDs are created as AVAILABLE stock, known ones
     * get their IMSI / number / operator filled in. Never touches PIN/PUK, and never changes the status of a SIM that
     * is already in use.
     */
    @Transactional
    public SimImportResponse importSims(SimImportRequest request) {
        forbidSupplierCrud();
        List<SimImportRequest.Row> rows = request == null || request.getRows() == null ? List.of() : request.getRows();
        if (rows.size() > 5000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "At most 5000 SIMs per upload");
        }
        String actor = accessScopeService.getCurrentUserEmail();
        String defaultOperator = trimToNull(request == null ? null : request.getDefaultOperator());
        SimImportResponse out = SimImportResponse.builder().received(rows.size()).build();
        java.util.Set<String> seen = new java.util.HashSet<>();
        int index = 0;
        for (SimImportRequest.Row row : rows) {
            index++;
            Integer rowNo = row.getRowNumber() != null ? row.getRowNumber() : index;
            String iccid = GatewayStatusService.normalizeIccid(clean(row.getIccid()));
            if (iccid == null || iccid.length() < 10) {
                out.setSkipped(out.getSkipped() + 1);
                out.getIssues().add(new SimImportResponse.RowIssue(rowNo, last4(iccid), "Missing or invalid ICCID"));
                continue;
            }
            if (!seen.add(iccid)) {
                out.setSkipped(out.getSkipped() + 1);
                out.getIssues().add(new SimImportResponse.RowIssue(rowNo, last4(iccid), "Same ICCID appears earlier in the file"));
                continue;
            }
            String imsi = GatewayStatusService.normalizeImsi(clean(row.getImsi()));
            String msisdn = normalizeMsisdn(clean(row.getMsisdn()));
            String operator = firstNonNull(trimToNull(clean(row.getOperator())), defaultOperator);
            String network = trimToNull(clean(row.getNetworkName()));
            SimNetworkState state = importNetworkState(clean(row.getState()));

            SimCard sim = simCardRepository.findByNormalizedIccid(iccid).orElse(null);
            if (sim == null) {
                sim = new SimCard();
                sim.setIccid(iccid);
                sim.setNormalizedIccid(iccid);
                sim.setImsi(imsi);
                sim.setNormalizedImsi(imsi);
                sim.setMsisdn(msisdn);
                sim.setOperator(operator);
                sim.setNetworkName(network);
                sim.setStatus(SimCardStatus.AVAILABLE);
                sim.setNetworkState(state);
                sim.setCondition(SimCondition.OK);
                String type = trimToNull(clean(row.getSimType()));
                sim.setNotes(firstNonNull(trimToNull(clean(row.getNotes())), type == null ? null : "Type: " + type));
                sim.setCreatedBy(actor);
                simCardRepository.save(sim);
                out.setCreated(out.getCreated() + 1);
                continue;
            }
            boolean changed = false;
            if (imsi != null && !imsi.equals(sim.getNormalizedImsi())) { sim.setImsi(imsi); sim.setNormalizedImsi(imsi); changed = true; }
            if (msisdn != null && !msisdn.equals(sim.getMsisdn())) { sim.setMsisdn(msisdn); changed = true; }
            if (operator != null && !operator.equals(sim.getOperator())) { sim.setOperator(operator); changed = true; }
            if (network != null && !network.equals(sim.getNetworkName())) { sim.setNetworkName(network); changed = true; }
            if (clean(row.getState()) != null && state != sim.getNetworkState()) { sim.setNetworkState(state); changed = true; }
            if (changed) {
                sim.setUpdatedBy(actor);
                simCardRepository.save(sim);
                out.setUpdated(out.getUpdated() + 1);
            } else {
                out.setUnchanged(out.getUnchanged() + 1);
            }
        }
        log.info("SIM import by={} received={} created={} updated={} unchanged={} skipped={}",
                actor, out.getReceived(), out.getCreated(), out.getUpdated(), out.getUnchanged(), out.getSkipped());
        return out;
    }

    /** Spreadsheet cells often carry tabs / non-breaking spaces from the operator portal export. */
    private static String clean(String s) {
        if (s == null) return null;
        String t = s.replace('\u00A0', ' ').replace("\t", " ").trim();
        return t.isEmpty() ? null : t;
    }

    /** Local Zimbabwe numbers (7XXXXXXXX or 07XXXXXXXX) are stored in international form 2637XXXXXXXX. */
    static String normalizeMsisdn(String raw) {
        if (raw == null) return null;
        String d = raw.replaceAll("[^0-9]", "");
        if (d.isEmpty()) return null;
        if (d.length() == 9 && d.startsWith("7")) return "263" + d;
        if (d.length() == 10 && d.startsWith("07")) return "263" + d.substring(1);
        return d;
    }

    /** The operator's line state from the spreadsheet ("Active", "Suspended", ...). */
    private static SimNetworkState importNetworkState(String state) {
        if (state == null) return SimNetworkState.ACTIVE;
        String v = state.trim().toUpperCase(java.util.Locale.ROOT);
        if (v.startsWith("INACTIV") || v.equals("IDLE") || v.equals("NEW") || v.startsWith("NOT ACTIV")) return SimNetworkState.INACTIVE;
        if (v.startsWith("ACTIV") || v.equals("AVAILABLE") || v.equals("LIVE")) return SimNetworkState.ACTIVE;
        if (v.startsWith("SUSPEND") || v.startsWith("BARR") || v.startsWith("BLOCK")) return SimNetworkState.SUSPENDED;
        if (v.startsWith("EXPIR")) return SimNetworkState.EXPIRED;
        if (v.startsWith("TERMIN") || v.startsWith("DEACT") || v.startsWith("DECOMM") || v.startsWith("CANCEL")) return SimNetworkState.DEACTIVATED;
        return SimNetworkState.ACTIVE;
    }

    private static String firstNonNull(String a, String b) {
        return a != null ? a : b;
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

    private static boolean looksLikeMask(String s) {
        if (s == null) return true;
        String t = s.trim();
        if (t.isEmpty()) return true;
        if (t.equals("****")) return true;
        if (t.startsWith("*") && (t.contains("************") || t.contains("********"))) return true;
        return t.chars().allMatch(c -> c == '*');
    }
}
