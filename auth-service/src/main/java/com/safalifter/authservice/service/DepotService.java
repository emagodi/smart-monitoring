package com.safalifter.authservice.service;

import com.safalifter.authservice.payload.request.DepotRequest;
import com.safalifter.authservice.payload.response.DepotResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface DepotService {
    DepotResponse create(DepotRequest request);
    DepotResponse getById(Long id);
    Page<DepotResponse> getAll(String search, Pageable pageable);
    List<DepotResponse> listByDistrictId(Long districtId);
    DepotResponse update(Long id, DepotRequest request);
    void delete(Long id);
}