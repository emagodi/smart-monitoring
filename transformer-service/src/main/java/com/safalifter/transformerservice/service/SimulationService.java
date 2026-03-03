package com.safalifter.transformerservice.service;

import com.safalifter.transformerservice.payload.request.SimulationRequest;
import com.safalifter.transformerservice.payload.response.SimulationResponse;
import org.springframework.web.multipart.MultipartFile;

public interface SimulationService {
    SimulationResponse simulateSensor(SimulationRequest request);
    SimulationResponse analyzeImage(MultipartFile file, String modelType);
    SimulationResponse simulateCameraImage(Long transformerId, MultipartFile file, String modelType);
}
