package com.safalifter.transformerservice.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import com.safalifter.transformerservice.config.AccessScopeService;
import com.safalifter.transformerservice.entities.Controller;
import com.safalifter.transformerservice.entities.Transformer;
import com.safalifter.transformerservice.payload.request.ControllerRequest;
import com.safalifter.transformerservice.payload.response.ControllerResponse;
import com.safalifter.transformerservice.repository.ControllerRepository;
import com.safalifter.transformerservice.repository.TransformerRepository;
import com.safalifter.transformerservice.service.ControllerService;

import java.util.List;

@Service
@Transactional
@RequiredArgsConstructor
public class ControllerServiceImpl implements ControllerService {

    private final ControllerRepository controllerRepository;
    private final TransformerRepository transformerRepository;
    private final AccessScopeService accessScopeService;

    @Override
    public ControllerResponse create(ControllerRequest request) {
        Transformer transformer = null;
        if (request.getTransformerId() != null) {
            transformer = findTransformerOrThrow(request.getTransformerId());
            controllerRepository.findByTransformerIdAndDeviceId(request.getTransformerId(), request.getDeviceId()).ifPresent(s -> { throw new ResponseStatusException(HttpStatus.CONFLICT, "Controller already exists on transformer"); });
        }
        String supplierCode = transformer != null ? transformer.getSupplierCode() : accessScopeService.getCurrentSupplierCode();
        String supplierName = transformer != null ? transformer.getSupplierName() : accessScopeService.getCurrentSupplierName();
        Controller controller = Controller.builder()
                .deviceId(request.getDeviceId())
                .devEui(request.getDevEui())
                .name(request.getName())
                .type(request.getType())
                .supplierCode(supplierCode)
                .supplierName(supplierName)
                .transformerId(request.getTransformerId())
                .build();
        Controller saved = controllerRepository.save(controller);
        return toResponse(saved);
    }

    @Override
    public ControllerResponse getById(Long id) {
        Controller controller = findControllerOrThrow(id);
        return toResponse(controller);
    }

    @Override
    public List<ControllerResponse> getAll() {
        String supplierCode = accessScopeService.getCurrentSupplierCode();
        List<Controller> controllers = supplierCode != null ? controllerRepository.findAllBySupplierCode(supplierCode) : controllerRepository.findAll();
        return controllers.stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    public List<ControllerResponse> listByTransformerId(Long transformerId) {
        findTransformerOrThrow(transformerId);
        String supplierCode = accessScopeService.getCurrentSupplierCode();
        List<Controller> controllers = supplierCode != null
                ? controllerRepository.findByTransformerIdAndSupplierCode(transformerId, supplierCode)
                : controllerRepository.findByTransformerId(transformerId);
        return controllers.stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    public ControllerResponse update(Long id, ControllerRequest request) {
        Controller controller = findControllerOrThrow(id);
        Transformer transformer = null;
        if (request.getTransformerId() != null) {
            transformer = findTransformerOrThrow(request.getTransformerId());
        }
        controller.setDeviceId(request.getDeviceId());
        controller.setDevEui(request.getDevEui());
        controller.setName(request.getName());
        controller.setType(request.getType());
        controller.setTransformerId(request.getTransformerId());
        if (transformer != null) {
            controller.setSupplierCode(transformer.getSupplierCode());
            controller.setSupplierName(transformer.getSupplierName());
        } else if (accessScopeService.isSupplierScoped()) {
            controller.setSupplierCode(accessScopeService.getCurrentSupplierCode());
            controller.setSupplierName(accessScopeService.getCurrentSupplierName());
        }
        Controller saved = controllerRepository.save(controller);
        return toResponse(saved);
    }

    @Override
    public void delete(Long id) {
        Controller controller = findControllerOrThrow(id);
        controllerRepository.delete(controller);
    }

    private Controller findControllerOrThrow(Long id) {
        String supplierCode = accessScopeService.getCurrentSupplierCode();
        return (supplierCode != null
                ? controllerRepository.findByIdAndSupplierCode(id, supplierCode)
                : controllerRepository.findById(id))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Controller with id " + id + " not found"));
    }

    private Transformer findTransformerOrThrow(Long transformerId) {
        String supplierCode = accessScopeService.getCurrentSupplierCode();
        return (supplierCode != null
                ? transformerRepository.findByIdAndSupplierCode(transformerId, supplierCode)
                : transformerRepository.findById(transformerId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transformer with id " + transformerId + " not found"));
    }

    private ControllerResponse toResponse(Controller controller) {
        return ControllerResponse.builder()
                .id(controller.getId())
                .deviceId(controller.getDeviceId())
                .devEui(controller.getDevEui())
                .name(controller.getName())
                .type(controller.getType())
                .supplierCode(controller.getSupplierCode())
                .supplierName(controller.getSupplierName())
                .transformerId(controller.getTransformerId())
                .createdAt(controller.getCreatedAt())
                .updatedAt(controller.getUpdatedAt())
                .build();
    }
}
