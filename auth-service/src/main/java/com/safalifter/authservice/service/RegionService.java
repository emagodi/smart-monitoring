package com.safalifter.authservice.service;

import com.safalifter.authservice.payload.request.RegionRequest;
import com.safalifter.authservice.payload.response.RegionResponse;

import java.util.List;

public interface RegionService {
    RegionResponse create(RegionRequest request);
    RegionResponse getById(Long id);
    List<RegionResponse> getAll();
    RegionResponse update(Long id, RegionRequest request);
    void delete(Long id);
}