package com.safalifter.transformerservice.service;

import com.safalifter.transformerservice.entities.SimulationController;
import com.safalifter.transformerservice.entities.SimulationCamera;
import com.safalifter.transformerservice.payload.request.SimulationRunRequest;
import com.safalifter.transformerservice.entities.SimulationAlert;
import java.util.List;
import java.util.Map;

public interface SimulationService {
    SimulationController createController(SimulationController controller);
    SimulationCamera createCamera(SimulationCamera camera);
    List<SimulationController> getAllControllers();
    List<SimulationCamera> getAllCameras();
    void runSimulation(SimulationRunRequest request);
    List<SimulationAlert> getLatestAlerts(int limit);
    Map<String, Object> getAiInsights();
    byte[] getImage(String filename);
}
