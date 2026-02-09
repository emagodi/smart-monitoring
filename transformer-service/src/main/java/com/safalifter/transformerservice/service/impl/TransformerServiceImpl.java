package com.safalifter.transformerservice.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import com.safalifter.transformerservice.entities.Transformer;
import com.safalifter.transformerservice.payload.request.TransformerRequest;
import com.safalifter.transformerservice.payload.response.SensorResponse;
import com.safalifter.transformerservice.payload.response.TransformerResponse;
import com.safalifter.transformerservice.repository.SensorRepository;
import com.safalifter.transformerservice.repository.TransformerRepository;
import com.safalifter.transformerservice.service.TransformerService;

import com.safalifter.transformerservice.client.AuthClient;
import com.safalifter.transformerservice.payload.response.DepotResponse;

import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

@Service
@Transactional
@RequiredArgsConstructor
public class TransformerServiceImpl implements TransformerService {

    private final TransformerRepository transformerRepository;
    private final SensorRepository sensorRepository;
    private final AuthClient authClient;

    @Override
    public TransformerResponse create(TransformerRequest request) {
        transformerRepository.findByDepotIdAndName(request.getDepotId(), request.getName()).ifPresent(t -> { throw new ResponseStatusException(HttpStatus.CONFLICT, "Transformer already exists in depot"); });
        
        String depotName = null;
        try {
            DepotResponse depot = authClient.getDepotById(request.getDepotId());
            if (depot != null) depotName = depot.getName();
        } catch (Exception e) {
            // Log error but proceed
        }

        Transformer transformer = Transformer.builder()
                .name(request.getName())
                .capacity(request.getCapacity())
                .isActive(request.getIsActive())
                .depotId(request.getDepotId())
                .depotName(depotName)
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
    public Page<TransformerResponse> getAll(String search, Pageable pageable) {
        if (search != null && !search.trim().isEmpty()) {
            return transformerRepository.findByNameContainingIgnoreCase(search, pageable).map(this::toResponse);
        }
        return transformerRepository.findAll(pageable).map(this::toResponse);
    }

    @Override
    public List<TransformerResponse> listByDepotId(Long depotId) {
        return transformerRepository.findByDepotId(depotId).stream().map(this::toResponse).toList();
    }

    @Override
    public TransformerResponse update(Long id, TransformerRequest request) {
        Transformer transformer = transformerRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transformer with id " + id + " not found"));
        transformerRepository.findByDepotIdAndName(request.getDepotId(), request.getName()).ifPresent(existing -> { if (!existing.getId().equals(id)) throw new ResponseStatusException(HttpStatus.CONFLICT, "Transformer already exists in depot"); });
        
        String depotName = transformer.getDepotName();
        if (!request.getDepotId().equals(transformer.getDepotId())) {
             try {
                DepotResponse depot = authClient.getDepotById(request.getDepotId());
                if (depot != null) depotName = depot.getName();
            } catch (Exception e) {
                depotName = null;
            }
        }
        
        transformer.setName(request.getName());
        transformer.setCapacity(request.getCapacity());
        transformer.setActive(request.getIsActive());
        transformer.setDepotId(request.getDepotId());
        transformer.setDepotName(depotName);
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
                        .build())
                .toList();
        return TransformerResponse.builder()
                .id(transformer.getId())
                .name(transformer.getName())
                .capacity(transformer.getCapacity())
                .isActive(transformer.isActive())
                .depotId(transformer.getDepotId())
                .depotName(transformer.getDepotName())
                .lat(transformer.getLat())
                .lng(transformer.getLng())
                .sensors(sensors)
                .build();
    }
}
