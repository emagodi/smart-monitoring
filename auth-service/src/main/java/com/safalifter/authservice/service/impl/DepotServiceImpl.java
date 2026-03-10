package com.safalifter.authservice.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.safalifter.authservice.entities.Depot;
import com.safalifter.authservice.entities.District;
import com.safalifter.authservice.exception.NotFoundException;
import com.safalifter.authservice.payload.request.DepotRequest;
import com.safalifter.authservice.payload.response.DepotResponse;
import com.safalifter.authservice.repository.DepotRepository;
import com.safalifter.authservice.repository.DistrictRepository;
import com.safalifter.authservice.service.DepotService;

import java.util.List;

@Service
@Transactional
@RequiredArgsConstructor
public class DepotServiceImpl implements DepotService {

    private final DepotRepository depotRepository;
    private final DistrictRepository districtRepository;

    @Override
    public DepotResponse create(DepotRequest request) {
        District district = districtRepository.findById(request.getDistrictId()).orElseThrow(() -> new NotFoundException("District with id " + request.getDistrictId() + " not found"));
        depotRepository.findByDistrictIdAndName(request.getDistrictId(), request.getName()).ifPresent(d -> { throw new IllegalArgumentException("Depot already exists in district"); });
        Depot depot = Depot.builder().name(request.getName()).district(district).build();
        Depot saved = depotRepository.save(depot);
        return toResponse(saved);
    }

    @Override
    public DepotResponse getById(Long id) {
        Depot depot = depotRepository.findById(id).orElseThrow(() -> new NotFoundException("Depot with id " + id + " not found"));
        return toResponse(depot);
    }

    @Override
    public List<DepotResponse> getAll() {
        return depotRepository.findAll().stream().map(this::toResponse).toList();
    }

    @Override
    public List<DepotResponse> listByDistrictId(Long districtId) {
        return depotRepository.findByDistrictId(districtId).stream().map(this::toResponse).toList();
    }

    @Override
    public DepotResponse update(Long id, DepotRequest request) {
        Depot depot = depotRepository.findById(id).orElseThrow(() -> new NotFoundException("Depot with id " + id + " not found"));
        District district = districtRepository.findById(request.getDistrictId()).orElseThrow(() -> new NotFoundException("District with id " + request.getDistrictId() + " not found"));
        depotRepository.findByDistrictIdAndName(request.getDistrictId(), request.getName()).ifPresent(existing -> { if (!existing.getId().equals(id)) throw new IllegalArgumentException("Depot already exists in district"); });
        depot.setName(request.getName());
        depot.setDistrict(district);
        Depot saved = depotRepository.save(depot);
        return toResponse(saved);
    }

    @Override
    public void delete(Long id) {
        Depot depot = depotRepository.findById(id).orElseThrow(() -> new NotFoundException("Depot with id " + id + " not found"));
        depotRepository.delete(depot);
    }

    private DepotResponse toResponse(Depot depot) {
        return DepotResponse.builder()
                .id(depot.getId())
                .name(depot.getName())
                .districtId(depot.getDistrict() != null ? depot.getDistrict().getId() : null)
                .build();
    }
}