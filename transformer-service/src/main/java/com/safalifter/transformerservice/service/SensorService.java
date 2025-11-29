package com.safalifter.transformerservice.service;

import com.safalifter.transformerservice.payload.request.SensorRequest;
import com.safalifter.transformerservice.payload.response.SensorResponse;

import java.util.List;

public interface SensorService {
    SensorResponse create(SensorRequest request);
    SensorResponse getById(Long id);
    List<SensorResponse> getAll();
    List<SensorResponse> listByTransformerId(Long transformerId);
    SensorResponse update(Long id, SensorRequest request);
    void delete(Long id);
}