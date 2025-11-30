package com.safalifter.transformerservice.service;

import com.safalifter.transformerservice.payload.request.SensorReadingRequest;
import com.safalifter.transformerservice.payload.response.SensorReadingResponse;

import java.util.List;
import com.safalifter.transformerservice.payload.response.SensorValueResponse;
import com.safalifter.transformerservice.payload.response.SensorReadingDetailResponse;

public interface SensorReadingService {
    SensorReadingResponse create(SensorReadingRequest request);
    SensorReadingResponse getById(Long id);
    List<SensorReadingResponse> getAll();
    List<SensorValueResponse> listBySensorId(Long sensorId);
    List<SensorValueResponse> listParsedValuesBySensorId(Long sensorId);
    List<SensorReadingDetailResponse> listDetailedParsedBySensorId(Long sensorId);
    SensorReadingResponse update(Long id, SensorReadingRequest request);
    void delete(Long id);
}