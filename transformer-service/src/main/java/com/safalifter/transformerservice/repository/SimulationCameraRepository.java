package com.safalifter.transformerservice.repository;

import com.safalifter.transformerservice.entities.SimulationCamera;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface SimulationCameraRepository extends JpaRepository<SimulationCamera, Long> {
    List<SimulationCamera> findByTransformerId(Long transformerId);
}
