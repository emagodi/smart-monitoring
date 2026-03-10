package com.safalifter.transformerservice.repository;

import com.safalifter.transformerservice.entities.SimulationCameraImage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SimulationCameraImageRepository extends JpaRepository<SimulationCameraImage, Long> {
    List<SimulationCameraImage> findTop5BySimulationCameraIdOrderByCapturedAtDesc(Long simulationCameraId);
    List<SimulationCameraImage> findBySimulationCameraIdAndCapturedAtBetweenOrderByCapturedAtDesc(Long simulationCameraId, java.time.LocalDateTime start, java.time.LocalDateTime end);
}
