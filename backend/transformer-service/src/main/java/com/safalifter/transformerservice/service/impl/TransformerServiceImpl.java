package com.safalifter.transformerservice.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import com.safalifter.transformerservice.entities.Transformer;
import com.safalifter.transformerservice.entities.TransformerType;
import com.safalifter.transformerservice.payload.request.TransformerRequest;
import com.safalifter.transformerservice.payload.response.SensorResponse;
import com.safalifter.transformerservice.payload.response.ControllerResponse;
import com.safalifter.transformerservice.payload.response.TransformerResponse;
import com.safalifter.transformerservice.config.AccessScopeService;
import com.safalifter.transformerservice.repository.SensorRepository;
import com.safalifter.transformerservice.repository.ControllerRepository;
import com.safalifter.transformerservice.repository.TransformerRepository;
import com.safalifter.transformerservice.service.TransformerService;
import lombok.extern.slf4j.Slf4j;

import java.util.List;

@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class TransformerServiceImpl implements TransformerService {

    private final TransformerRepository transformerRepository;
    private final SensorRepository sensorRepository;
    private final ControllerRepository controllerRepository;
    private final AccessScopeService accessScopeService;

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
        return toResponse(saved);
    }

    @Override
    public TransformerResponse getById(Long id) {
        Transformer transformer = findTransformerOrThrow(id);
        return toResponse(transformer);
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
                ? transformerRepository.findByDepotIdAndSupplierCode(depotId, supplierCode)
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
        return supplierCode != null ? transformerRepository.findAllBySupplierCode(supplierCode) : transformerRepository.findAll();
    }

    private Transformer findTransformerOrThrow(Long id) {
        String supplierCode = accessScopeService.getCurrentSupplierCode();
        return (supplierCode != null
                ? transformerRepository.findByIdAndSupplierCode(id, supplierCode)
                : transformerRepository.findById(id))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transformer with id " + id + " not found"));
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

    private TransformerResponse toResponse(Transformer transformer) {
        List<SensorResponse> sensors = sensorRepository.findByTransformerId(transformer.getId()).stream()
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
        List<ControllerResponse> controllers = controllerRepository.findByTransformerId(transformer.getId()).stream()
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
                .lat(transformer.getLat())
                .lng(transformer.getLng())
                .sensors(sensors)
                .controllers(controllers)
                .build();
    }
}
