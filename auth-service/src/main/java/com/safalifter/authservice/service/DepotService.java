package com.safalifter.authservice.service;

import com.safalifter.authservice.payload.request.DepotRequest;
import com.safalifter.authservice.payload.response.DepotResponse;

import java.util.List;

public interface DepotService {
    DepotResponse create(DepotRequest request);
    DepotResponse getById(Long id);
    List<DepotResponse> getAll();
    List<DepotResponse> listByDistrictId(Long districtId);
    DepotResponse update(Long id, DepotRequest request);
    void delete(Long id);
}