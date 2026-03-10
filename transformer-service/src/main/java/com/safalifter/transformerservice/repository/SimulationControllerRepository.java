package com.safalifter.transformerservice.repository;

import com.safalifter.transformerservice.entities.SimulationController;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface SimulationControllerRepository extends JpaRepository<SimulationController, Long> {
    Optional<SimulationController> findByTransformerId(Long transformerId);
    Optional<SimulationController> findByDevEui(String devEui);
}
