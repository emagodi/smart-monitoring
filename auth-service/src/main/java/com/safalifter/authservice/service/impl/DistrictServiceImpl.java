package com.safalifter.authservice.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.safalifter.authservice.entities.District;
import com.safalifter.authservice.entities.Region;
import com.safalifter.authservice.entities.Depot;
import com.safalifter.authservice.exception.NotFoundException;
import com.safalifter.authservice.payload.request.DistrictRequest;
import com.safalifter.authservice.payload.response.DepotResponse;
import com.safalifter.authservice.payload.response.DistrictResponse;
import com.safalifter.authservice.repository.DepotRepository;
import com.safalifter.authservice.repository.DistrictRepository;
import com.safalifter.authservice.repository.RegionRepository;
import com.safalifter.authservice.service.DistrictService;

import java.util.List;

@Service
@Transactional
@RequiredArgsConstructor
public class DistrictServiceImpl implements DistrictService {

    private final DistrictRepository districtRepository;
    private final RegionRepository regionRepository;
    private final DepotRepository depotRepository;

    @Override
    public DistrictResponse create(DistrictRequest request) {
        Region region = regionRepository.findById(request.getRegionId()).orElseThrow(() -> new NotFoundException("Region with id " + request.getRegionId() + " not found"));
        districtRepository.findByRegionIdAndName(request.getRegionId(), request.getName()).ifPresent(d -> { throw new IllegalArgumentException("District already exists in region"); });
        District district = District.builder().name(request.getName()).region(region).build();
        District saved = districtRepository.save(district);
        return toResponse(saved);
    }

    @Override
    public DistrictResponse getById(Long id) {
        District district = districtRepository.findById(id).orElseThrow(() -> new NotFoundException("District with id " + id + " not found"));
        return toResponse(district);
    }

    @Override
    public List<DistrictResponse> getAll() {
        return districtRepository.findAll().stream().map(this::toResponse).toList();
    }

    @Override
    public List<DistrictResponse> listByRegionId(Long regionId) {
        return districtRepository.findByRegionId(regionId).stream().map(this::toResponse).toList();
    }

    @Override
    public DistrictResponse update(Long id, DistrictRequest request) {
        District district = districtRepository.findById(id).orElseThrow(() -> new NotFoundException("District with id " + id + " not found"));
        Region region = regionRepository.findById(request.getRegionId()).orElseThrow(() -> new NotFoundException("Region with id " + request.getRegionId() + " not found"));
        districtRepository.findByRegionIdAndName(request.getRegionId(), request.getName()).ifPresent(existing -> { if (!existing.getId().equals(id)) throw new IllegalArgumentException("District already exists in region"); });
        district.setName(request.getName());
        district.setRegion(region);
        District saved = districtRepository.save(district);
        return toResponse(saved);
    }

    @Override
    public void delete(Long id) {
        District district = districtRepository.findById(id).orElseThrow(() -> new NotFoundException("District with id " + id + " not found"));
        districtRepository.delete(district);
    }

    private DistrictResponse toResponse(District district) {
        List<DepotResponse> depots = depotRepository.findByDistrictId(district.getId())
                .stream()
                .map(d -> DepotResponse.builder().id(d.getId()).name(d.getName()).districtId(d.getDistrict().getId()).build())
                .toList();
        return DistrictResponse.builder()
                .id(district.getId())
                .name(district.getName())
                .regionId(district.getRegion() != null ? district.getRegion().getId() : null)
                .depots(depots)
                .build();
    }
}