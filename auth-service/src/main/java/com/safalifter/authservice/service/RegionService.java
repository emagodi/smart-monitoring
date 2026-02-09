package com.safalifter.authservice.service;

import com.safalifter.authservice.payload.request.RegionRequest;
import com.safalifter.authservice.payload.response.RegionResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface RegionService {
    RegionResponse create(RegionRequest request);
    RegionResponse getById(Long id);
    Page<RegionResponse> getAll(Pageable pageable);
    RegionResponse update(Long id, RegionRequest request);
    void delete(Long id);
}