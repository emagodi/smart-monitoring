package com.safalifter.transformerservice.service;

import com.safalifter.transformerservice.payload.request.AlertRequest;
import com.safalifter.transformerservice.payload.response.AlertResponse;

import java.util.List;

public interface AlertService {
    AlertResponse create(AlertRequest request);
    AlertResponse getById(Long id);
    List<AlertResponse> getAll();
    List<AlertResponse> listBySensorId(Long sensorId);
    AlertResponse update(Long id, AlertRequest request);
    void delete(Long id);
}