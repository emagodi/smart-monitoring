package com.safalifter.authservice.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.safalifter.authservice.entities.Region;
import com.safalifter.authservice.exception.NotFoundException;
import com.safalifter.authservice.payload.request.RegionRequest;
import com.safalifter.authservice.payload.response.RegionResponse;
import com.safalifter.authservice.payload.response.DistrictResponse;
import com.safalifter.authservice.payload.response.DepotResponse;
import com.safalifter.authservice.repository.RegionRepository;
import com.safalifter.authservice.repository.DistrictRepository;
import com.safalifter.authservice.repository.DepotRepository;
import com.safalifter.authservice.service.RegionService;

import java.util.List;

@Service
@Transactional
@RequiredArgsConstructor
public class RegionServiceImpl implements RegionService {

    private final RegionRepository regionRepository;
    private final DistrictRepository districtRepository;
    private final DepotRepository depotRepository;

    @Override
    public RegionResponse create(RegionRequest request) {
        regionRepository.findByName(request.getName()).ifPresent(r -> { throw new IllegalArgumentException("Region already exists"); });
        Region region = Region.builder().name(request.getName()).build();
        Region saved = regionRepository.save(region);
        return toResponse(saved);
    }

    @Override
    public RegionResponse getById(Long id) {
        Region region = regionRepository.findById(id).orElseThrow(() -> new NotFoundException("Region with id " + id + " not found"));
        return toResponse(region);
    }

    @Override
    public List<RegionResponse> getAll() {
        return regionRepository.findAll().stream().map(this::toResponse).toList();
    }

    @Override
    public RegionResponse update(Long id, RegionRequest request) {
        Region region = regionRepository.findById(id).orElseThrow(() -> new NotFoundException("Region with id " + id + " not found"));
        regionRepository.findByName(request.getName()).ifPresent(existing -> { if (!existing.getId().equals(id)) throw new IllegalArgumentException("Region already exists"); });
        region.setName(request.getName());
        Region saved = regionRepository.save(region);
        return toResponse(saved);
    }

    @Override
    public void delete(Long id) {
        Region region = regionRepository.findById(id).orElseThrow(() -> new NotFoundException("Region with id " + id + " not found"));
        regionRepository.delete(region);
    }

    private RegionResponse toResponse(Region region) {
        List<DistrictResponse> districts = districtRepository.findByRegionId(region.getId())
                .stream()
                .map(d -> {
                    List<DepotResponse> depots = depotRepository.findByDistrictId(d.getId())
                            .stream()
                            .map(dp -> DepotResponse.builder().id(dp.getId()).name(dp.getName()).districtId(dp.getDistrict().getId()).build())
                            .toList();
                    return DistrictResponse.builder()
                            .id(d.getId())
                            .name(d.getName())
                            .regionId(region.getId())
                            .depots(depots)
                            .build();
                })
                .toList();
        return RegionResponse.builder().id(region.getId()).name(region.getName()).districts(districts).build();
    }
}