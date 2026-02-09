package com.safalifter.authservice.service;

import com.safalifter.authservice.payload.request.DistrictRequest;
import com.safalifter.authservice.payload.response.DistrictResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface DistrictService {
    DistrictResponse create(DistrictRequest request);
    DistrictResponse getById(Long id);
    Page<DistrictResponse> getAll(String search, Pageable pageable);
    List<DistrictResponse> listByRegionId(Long regionId);
    DistrictResponse update(Long id, DistrictRequest request);
    void delete(Long id);
}