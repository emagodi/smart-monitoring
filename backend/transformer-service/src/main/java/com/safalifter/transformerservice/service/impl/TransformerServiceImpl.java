package com.safalifter.transformerservice.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;
import com.safalifter.transformerservice.entities.Controller;
import com.safalifter.transformerservice.entities.Transformer;
import com.safalifter.transformerservice.entities.TransformerType;
import com.safalifter.transformerservice.payload.request.TransformerRequest;
import com.safalifter.transformerservice.payload.response.SensorResponse;
import com.safalifter.transformerservice.payload.response.ControllerResponse;
import com.safalifter.transformerservice.payload.response.ExternalTransformerLookupResponse;
import com.safalifter.transformerservice.payload.response.TransformerResponse;
import com.safalifter.transformerservice.config.AccessScopeService;
import com.safalifter.transformerservice.repository.SensorRepository;
import com.safalifter.transformerservice.repository.ControllerRepository;
import com.safalifter.transformerservice.repository.TransformerRepository;
import com.safalifter.transformerservice.service.TransformerService;
import lombok.extern.slf4j.Slf4j;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class TransformerServiceImpl implements TransformerService {

    private final TransformerRepository transformerRepository;
    private final SensorRepository sensorRepository;
    private final ControllerRepository controllerRepository;
    private final AccessScopeService accessScopeService;
    private final RestTemplate restTemplate;

    @Value("${remote.transformer.lookup.url:http://68.183.126.109:3001/api/transformer/details}")
    private String remoteTransformerLookupUrl;

    @Override
    public TransformerResponse create(TransformerRequest request) {
        forbidSupplierCrud();
        String supplierCode = accessScopeService.getCurrentSupplierCode();
        TransformerType transformerType = resolveTransformerType(request.getType());
        if (supplierCode != null) {
            transformerRepository.findBySupplierCodeAndName(supplierCode, request.getName()).ifPresent(t -> {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Transformer already exists for supplier");
            });
        } else {
            transformerRepository.findByDepotIdAndName(request.getDepotId(), request.getName()).ifPresent(t -> {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Transformer already exists in depot");
            });
        }
        Transformer transformer = Transformer.builder()
                .name(request.getName())
                .capacity(request.getCapacity())
                .isActive(request.getIsActive())
                .depotId(request.getDepotId())
                .supplierCode(supplierCode)
                .supplierName(accessScopeService.getCurrentSupplierName())
                .type(transformerType)
                .lat(request.getLat())
                .lng(request.getLng())
                .build();
        Transformer saved = transformerRepository.save(transformer);
        assignControllerByEui(saved, request.getControllerEui());
        return toResponse(saved);
    }

    @Override
    public TransformerResponse getById(Long id) {
        Transformer transformer = findTransformerOrThrow(id);
        return toResponse(transformer);
    }

    @Override
    @Transactional(readOnly = true)
    public ExternalTransformerLookupResponse lookupRemoteByEui(String eui) {
        String normalizedEui = trimToNull(eui);
        if (normalizedEui == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "EUI is required");
        }

        try {
            JsonNode root = restTemplate.getForObject(
                    remoteTransformerLookupUrl + "?eui={eui}",
                    JsonNode.class,
                    normalizedEui
            );
            JsonNode transformerNode = root != null ? root.path("transformers").path(0) : null;
            if (transformerNode == null || transformerNode.isMissingNode()) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No remote transformer details found for EUI " + normalizedEui);
            }

            JsonNode locationNode = transformerNode.path("location");
            return ExternalTransformerLookupResponse.builder()
                    .eui(normalizedEui)
                    .transformerName(trimToNull(transformerNode.path("transformerName").asText(null)))
                    .rawTransformerType(trimToNull(transformerNode.path("transformerType").asText(null)))
                    .transformerType(mapRemoteTransformerType(transformerNode.path("transformerType").asText(null)))
                    .lat(readDecimal(locationNode, "latitude"))
                    .lng(readDecimal(locationNode, "longitude"))
                    .build();
        } catch (ResponseStatusException exception) {
            throw exception;
        } catch (RestClientException exception) {
            log.error("Failed to lookup remote transformer details for EUI {}", normalizedEui, exception);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Failed to load remote transformer details");
        }
    }

    @Override
    public List<TransformerResponse> getAll() {
        return listScopedTransformers().stream().map(this::toResponse).toList();
    }

    @Override
    public List<TransformerResponse> getAssignmentOptions() {
        return transformerRepository.findAll().stream().map(this::toResponse).toList();
    }

    @Override
    public List<TransformerResponse> listByDepotId(Long depotId) {
        String supplierCode = accessScopeService.getCurrentSupplierCode();
        List<Transformer> transformers = supplierCode != null
                ? listScopedTransformers().stream()
                    .filter(transformer -> Objects.equals(transformer.getDepotId(), depotId))
                    .toList()
                : transformerRepository.findByDepotId(depotId);
        return transformers.stream().map(this::toResponse).toList();
    }

    @Override
    public TransformerResponse update(Long id, TransformerRequest request) {
        forbidSupplierCrud();
        Transformer transformer = findTransformerOrThrow(id);
        String supplierCode = accessScopeService.getCurrentSupplierCode();
        TransformerType transformerType = resolveTransformerType(request.getType());
        if (supplierCode != null) {
            transformerRepository.findBySupplierCodeAndName(supplierCode, request.getName()).ifPresent(existing -> {
                if (!existing.getId().equals(id)) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Transformer already exists for supplier");
                }
            });
        } else {
            transformerRepository.findByDepotIdAndName(request.getDepotId(), request.getName()).ifPresent(existing -> {
                if (!existing.getId().equals(id)) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Transformer already exists in depot");
                }
            });
        }
        transformer.setName(request.getName());
        transformer.setCapacity(request.getCapacity());
        transformer.setActive(request.getIsActive());
        transformer.setDepotId(request.getDepotId());
        if (supplierCode != null) {
            transformer.setSupplierCode(supplierCode);
            transformer.setSupplierName(accessScopeService.getCurrentSupplierName());
        }
        transformer.setType(transformerType);
        transformer.setLat(request.getLat());
        transformer.setLng(request.getLng());
        Transformer saved = transformerRepository.save(transformer);
        return toResponse(saved);
    }

    @Override
    public void delete(Long id) {
        forbidSupplierCrud();
        Transformer transformer = findTransformerOrThrow(id);
        transformerRepository.delete(transformer);
    }

    private List<Transformer> listScopedTransformers() {
        String supplierCode = accessScopeService.getCurrentSupplierCode();
        if (supplierCode == null) {
            return transformerRepository.findAll();
        }

        LinkedHashMap<Long, Transformer> visible = new LinkedHashMap<>();
        transformerRepository.findAllBySupplierCode(supplierCode)
                .forEach(transformer -> visible.put(transformer.getId(), transformer));

        Set<Long> linkedTransformerIds = controllerRepository.findAllBySupplierCode(supplierCode).stream()
                .map(c -> c.getTransformerId())
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        linkedTransformerIds.addAll(sensorRepository.findAllBySupplierCode(supplierCode).stream()
                .map(s -> s.getTransformerId())
                .filter(Objects::nonNull)
                .collect(Collectors.toSet()));

        transformerRepository.findAllById(linkedTransformerIds)
                .forEach(transformer -> visible.put(transformer.getId(), transformer));

        return List.copyOf(visible.values());
    }

    private Transformer findTransformerOrThrow(Long id) {
        String supplierCode = accessScopeService.getCurrentSupplierCode();
        return (supplierCode != null
                ? transformerRepository.findById(id).filter(transformer -> isVisibleToSupplier(transformer, supplierCode))
                : transformerRepository.findById(id))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transformer with id " + id + " not found"));
    }

    private boolean isVisibleToSupplier(Transformer transformer, String supplierCode) {
        if (transformer == null) {
            return false;
        }
        if (supplierCode.equalsIgnoreCase(String.valueOf(transformer.getSupplierCode()))) {
            return true;
        }
        return controllerRepository.findByTransformerIdAndSupplierCode(transformer.getId(), supplierCode).stream().findAny().isPresent()
                || sensorRepository.findByTransformerIdAndSupplierCode(transformer.getId(), supplierCode).stream().findAny().isPresent();
    }

    private void forbidSupplierCrud() {
        if (accessScopeService.isSupplierScoped()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Supplier users cannot create, update, or delete transformers");
        }
    }

    private TransformerType resolveTransformerType(String typeValue) {
        TransformerType parsed = TransformerType.fromValue(typeValue);
        if (typeValue != null && !typeValue.isBlank() && parsed == null) {
            log.warn("Ignoring unsupported transformer type value '{}'", typeValue);
        }
        return parsed;
    }

    private void assignControllerByEui(Transformer transformer, String controllerEui) {
        String normalizedEui = trimToNull(controllerEui);
        if (normalizedEui == null || transformer == null || transformer.getId() == null) {
            return;
        }

        Controller controller = resolveAssignableController(transformer, normalizedEui);
        if (controller == null) {
            log.info("No unambiguous local controller found for auto-assignment using EUI {}", normalizedEui);
            return;
        }
        if (controller.getTransformerId() != null && !controller.getTransformerId().equals(transformer.getId())) {
            log.info(
                    "Skipping auto-assignment for controller {} because it is already linked to transformer {}",
                    normalizedEui,
                    controller.getTransformerId()
            );
            return;
        }

        controller.setTransformerId(transformer.getId());
        if (transformer.getSupplierCode() != null && !transformer.getSupplierCode().isBlank()) {
            controller.setSupplierCode(transformer.getSupplierCode());
            controller.setSupplierName(transformer.getSupplierName());
        }
        controllerRepository.save(controller);
        log.info("Auto-assigned controller {} to transformer {}", normalizedEui, transformer.getId());
    }

    private Controller resolveAssignableController(Transformer transformer, String normalizedEui) {
        LinkedHashMap<Long, Controller> candidates = new LinkedHashMap<>();
        controllerRepository.findAllByDevEuiIgnoreCase(normalizedEui).forEach(controller -> candidates.put(controller.getId(), controller));
        controllerRepository.findAllByDeviceIdIgnoreCase(normalizedEui).forEach(controller -> candidates.put(controller.getId(), controller));
        if (candidates.isEmpty()) {
            return null;
        }

        List<Controller> ranked = candidates.values().stream()
                .sorted(Comparator
                        .comparing((Controller controller) -> controller.getTransformerId() != null)
                        .thenComparing((Controller controller) -> !matchesPreferredSupplier(transformer, controller))
                        .thenComparing((Controller controller) -> controller.getSupplierCode() == null)
                        .thenComparing(Controller::getId))
                .toList();

        Controller best = ranked.get(0);
        long bestRankCount = ranked.stream()
                .filter(controller -> sameControllerRank(transformer, best, controller))
                .count();
        if (bestRankCount > 1 && best.getTransformerId() == null) {
            log.warn("Multiple controller candidates share the same best rank for EUI {}. Skipping auto-assignment.", normalizedEui);
            return null;
        }
        return best;
    }

    private boolean matchesPreferredSupplier(Transformer transformer, Controller controller) {
        String transformerSupplier = transformer != null ? trimToNull(transformer.getSupplierCode()) : null;
        String controllerSupplier = controller != null ? trimToNull(controller.getSupplierCode()) : null;
        if (transformerSupplier != null) {
            return transformerSupplier.equalsIgnoreCase(String.valueOf(controllerSupplier));
        }
        return "oculus".equalsIgnoreCase(String.valueOf(controllerSupplier));
    }

    private boolean sameControllerRank(Transformer transformer, Controller left, Controller right) {
        return (left.getTransformerId() != null) == (right.getTransformerId() != null)
                && matchesPreferredSupplier(transformer, left) == matchesPreferredSupplier(transformer, right)
                && (left.getSupplierCode() == null) == (right.getSupplierCode() == null);
    }

    private String mapRemoteTransformerType(String remoteType) {
        String normalized = trimToNull(remoteType);
        if (normalized == null) {
            return null;
        }
        String lower = normalized.toLowerCase(Locale.ROOT);
        if (lower.contains("ground")) {
            return TransformerType.GROUND_MOUNTED.name();
        }
        if (lower.contains("pole")) {
            return TransformerType.POLE_MOUNTED.name();
        }
        return null;
    }

    private BigDecimal readDecimal(JsonNode parent, String fieldName) {
        if (parent == null) {
            return null;
        }
        JsonNode field = parent.path(fieldName);
        return field.isNumber() ? field.decimalValue() : null;
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private TransformerResponse toResponse(Transformer transformer) {
        String supplierCode = accessScopeService.getCurrentSupplierCode();
        List<SensorResponse> sensors = (supplierCode != null
                ? sensorRepository.findByTransformerIdAndSupplierCode(transformer.getId(), supplierCode)
                : sensorRepository.findByTransformerId(transformer.getId())).stream()
                .map(s -> SensorResponse.builder()
                        .id(s.getId())
                        .deviceId(s.getDeviceId())
                        .devEui(s.getDevEui())
                        .name(s.getName())
                        .type(s.getType())
                        .supplierCode(s.getSupplierCode())
                        .supplierName(s.getSupplierName())
                        .transformerId(transformer.getId())
                        .createdAt(s.getCreatedAt())
                        .updatedAt(s.getUpdatedAt())
                        .build())
                .toList();
        List<ControllerResponse> controllers = (supplierCode != null
                ? controllerRepository.findByTransformerIdAndSupplierCode(transformer.getId(), supplierCode)
                : controllerRepository.findByTransformerId(transformer.getId())).stream()
                .map(c -> ControllerResponse.builder()
                        .id(c.getId())
                        .deviceId(c.getDeviceId())
                        .devEui(c.getDevEui())
                        .name(c.getName())
                        .type(c.getType())
                        .supplierCode(c.getSupplierCode())
                        .supplierName(c.getSupplierName())
                        .transformerId(transformer.getId())
                        .createdAt(c.getCreatedAt())
                        .updatedAt(c.getUpdatedAt())
                        .build())
                .toList();
        return TransformerResponse.builder()
                .id(transformer.getId())
                .name(transformer.getName())
                .capacity(transformer.getCapacity())
                .isActive(transformer.isActive())
                .depotId(transformer.getDepotId())
                .supplierCode(transformer.getSupplierCode())
                .supplierName(transformer.getSupplierName())
                .type(transformer.getType() != null ? transformer.getType().name() : null)
                .locationLabel(transformer.getLat() != null && transformer.getLng() != null ? transformer.getLat() + ", " + transformer.getLng() : null)
                .lat(transformer.getLat())
                .lng(transformer.getLng())
                .sensors(sensors)
                .controllers(controllers)
                .build();
    }
}
