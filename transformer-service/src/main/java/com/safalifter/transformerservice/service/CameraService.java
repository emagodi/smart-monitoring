package com.safalifter.transformerservice.service;

import com.safalifter.transformerservice.payload.request.CameraEventRequest;
import com.safalifter.transformerservice.payload.request.CameraRequest;
import com.safalifter.transformerservice.payload.response.CameraResponse;

import java.util.List;

public interface CameraService {
    CameraResponse register(CameraRequest request);
    void processEvent(CameraEventRequest event);
    List<CameraResponse> getAll();
    List<CameraResponse> getByTransformerId(Long transformerId);
    CameraResponse getById(Long id);
    CameraResponse update(Long id, CameraRequest request);
    void delete(Long id);
}
