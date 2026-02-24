package com.safalifter.transformerservice.service;

import com.safalifter.transformerservice.payload.request.SensorReadingRequest;
import com.safalifter.transformerservice.payload.response.SensorReadingResponse;
import com.safalifter.transformerservice.payload.response.SensorValueResponse;
import com.safalifter.transformerservice.payload.response.SensorReadingDetailResponse;

import java.time.LocalDateTime;
import java.util.List;

public interface SensorReadingService {
    SensorReadingResponse create(SensorReadingRequest request);
    SensorReadingResponse getById(Long id);
    List<SensorReadingResponse> getAll();
    List<SensorValueResponse> listBySensorId(Long sensorId);
    List<SensorValueResponse> listBySensorIdAndDateRange(Long sensorId, LocalDateTime start, LocalDateTime end);
    List<SensorValueResponse> listParsedValuesBySensorId(Long sensorId);
    List<SensorReadingDetailResponse> listDetailedParsedBySensorId(Long sensorId);
    SensorReadingResponse update(Long id, SensorReadingRequest request);
    void delete(Long id);
}
