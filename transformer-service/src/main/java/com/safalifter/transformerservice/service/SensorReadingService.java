package com.safalifter.transformerservice.service;

import com.safalifter.transformerservice.payload.request.SensorReadingRequest;
import com.safalifter.transformerservice.payload.response.SensorReadingResponse;

import java.util.List;

public interface SensorReadingService {
    SensorReadingResponse create(SensorReadingRequest request);
    SensorReadingResponse getById(Long id);
    List<SensorReadingResponse> getAll();
    List<SensorReadingResponse> listBySensorId(Long sensorId);
    SensorReadingResponse update(Long id, SensorReadingRequest request);
    void delete(Long id);
}