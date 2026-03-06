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
import com.safalifter.transformerservice.payload.response.CameraResponse;
import com.safalifter.transformerservice.payload.response.TransformerResponse;
import com.safalifter.transformerservice.repository.SensorRepository;
import com.safalifter.transformerservice.repository.ControllerRepository;
import com.safalifter.transformerservice.repository.CameraRepository;
import com.safalifter.transformerservice.repository.TransformerRepository;
import com.safalifter.transformerservice.service.TransformerService;

import java.util.List;

@Service
@Transactional
@RequiredArgsConstructor
public class TransformerServiceImpl implements TransformerService {

    private final TransformerRepository transformerRepository;
    private final SensorRepository sensorRepository;
    private final ControllerRepository controllerRepository;
    private final CameraRepository cameraRepository;

    @Override
    public TransformerResponse create(TransformerRequest request) {
        transformerRepository.findByDepotIdAndName(request.getDepotId(), request.getName()).ifPresent(t -> { throw new ResponseStatusException(HttpStatus.CONFLICT, "Transformer already exists in depot"); });
        Transformer transformer = Transformer.builder()
                .name(request.getName())
                .capacity(request.getCapacity())
                .isActive(request.getIsActive())
                .depotId(request.getDepotId())
                .type(request.getType() != null ? TransformerType.valueOf(request.getType()) : null)
                .lat(request.getLat())
                .lng(request.getLng())
                .build();
        Transformer saved = transformerRepository.save(transformer);
        return toResponse(saved);
    }

    @Override
    public TransformerResponse getById(Long id) {
        Transformer transformer = transformerRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transformer with id " + id + " not found"));
        return toResponse(transformer);
    }

    @Override
    public List<TransformerResponse> getAll() {
        return transformerRepository.findAll().stream().map(this::toResponse).toList();
    }

    @Override
    public List<TransformerResponse> listByDepotId(Long depotId) {
        return transformerRepository.findByDepotId(depotId).stream().map(this::toResponse).toList();
    }

    @Override
    public TransformerResponse update(Long id, TransformerRequest request) {
        Transformer transformer = transformerRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transformer with id " + id + " not found"));
        transformerRepository.findByDepotIdAndName(request.getDepotId(), request.getName()).ifPresent(existing -> { if (!existing.getId().equals(id)) throw new ResponseStatusException(HttpStatus.CONFLICT, "Transformer already exists in depot"); });
        transformer.setName(request.getName());
        transformer.setCapacity(request.getCapacity());
        transformer.setActive(request.getIsActive());
        transformer.setDepotId(request.getDepotId());
        if (request.getType() != null && !request.getType().isEmpty()) {
            transformer.setType(TransformerType.valueOf(request.getType()));
        }
        transformer.setLat(request.getLat());
        transformer.setLng(request.getLng());
        Transformer saved = transformerRepository.save(transformer);
        return toResponse(saved);
    }

    @Override
    public void delete(Long id) {
        Transformer transformer = transformerRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transformer with id " + id + " not found"));
        transformerRepository.delete(transformer);
    }

    private TransformerResponse toResponse(Transformer transformer) {
        List<SensorResponse> sensors = sensorRepository.findByTransformerId(transformer.getId()).stream()
                .map(s -> SensorResponse.builder()
                        .id(s.getId())
                        .deviceId(s.getDeviceId())
                        .devEui(s.getDevEui())
                        .name(s.getName())
                        .type(s.getType())
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
                        .transformerId(transformer.getId())
                        .createdAt(c.getCreatedAt())
                        .updatedAt(c.getUpdatedAt())
                        .build())
                .toList();
        List<CameraResponse> cameras = cameraRepository.findByTransformerId(transformer.getId()).stream()
                .map(c -> CameraResponse.builder()
                        .id(c.getId())
                        .name(c.getName())
                        .topic(c.getTopic())
                        .transformerId(c.getTransformerId())
                        .status(c.getStatus())
                        .model(c.getModel())
                        .wifiSsid(c.getWifiSsid())
                        .macAddress(c.getMacAddress())
                        .ipAddress(c.getIpAddress())
                        .build())
                .toList();
        return TransformerResponse.builder()
                .id(transformer.getId())
                .name(transformer.getName())
                .capacity(transformer.getCapacity())
                .isActive(transformer.isActive())
                .depotId(transformer.getDepotId())
                .type(transformer.getType() != null ? transformer.getType().name() : null)
                .lat(transformer.getLat())
                .lng(transformer.getLng())
                .sensors(sensors)
                .controllers(controllers)
                .cameras(cameras)
                .build();
    }
}
