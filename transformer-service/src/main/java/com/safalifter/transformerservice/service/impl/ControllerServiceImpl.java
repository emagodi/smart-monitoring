package com.safalifter.transformerservice.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import com.safalifter.transformerservice.entities.Controller;
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

    @Override
    public ControllerResponse create(ControllerRequest request) {
        if (request.getTransformerId() != null) {
            transformerRepository.findById(request.getTransformerId()).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transformer with id " + request.getTransformerId() + " not found"));
            controllerRepository.findByTransformerIdAndDeviceId(request.getTransformerId(), request.getDeviceId()).ifPresent(s -> { throw new ResponseStatusException(HttpStatus.CONFLICT, "Controller already exists on transformer"); });
        }
        Controller controller = Controller.builder()
                .deviceId(request.getDeviceId())
                .devEui(request.getDevEui())
                .name(request.getName())
                .type(request.getType())
                .transformerId(request.getTransformerId())
                .build();
        Controller saved = controllerRepository.save(controller);
        return toResponse(saved);
    }

    @Override
    public ControllerResponse getById(Long id) {
        Controller controller = controllerRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Controller with id " + id + " not found"));
        return toResponse(controller);
    }

    @Override
    public List<ControllerResponse> getAll() {
        return controllerRepository.findAll().stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    public List<ControllerResponse> listByTransformerId(Long transformerId) {
        return controllerRepository.findByTransformerId(transformerId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    public ControllerResponse update(Long id, ControllerRequest request) {
        Controller controller = controllerRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Controller with id " + id + " not found"));
        if (request.getTransformerId() != null) {
            transformerRepository.findById(request.getTransformerId()).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transformer with id " + request.getTransformerId() + " not found"));
        }
        controller.setDeviceId(request.getDeviceId());
        controller.setDevEui(request.getDevEui());
        controller.setName(request.getName());
        controller.setType(request.getType());
        controller.setTransformerId(request.getTransformerId());
        Controller saved = controllerRepository.save(controller);
        return toResponse(saved);
    }

    @Override
    public void delete(Long id) {
        Controller controller = controllerRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Controller with id " + id + " not found"));
        controllerRepository.delete(controller);
    }

    private ControllerResponse toResponse(Controller controller) {
        return ControllerResponse.builder()
                .id(controller.getId())
                .deviceId(controller.getDeviceId())
                .devEui(controller.getDevEui())
                .name(controller.getName())
                .type(controller.getType())
                .transformerId(controller.getTransformerId())
                .createdAt(controller.getCreatedAt())
                .updatedAt(controller.getUpdatedAt())
                .build();
    }
}
