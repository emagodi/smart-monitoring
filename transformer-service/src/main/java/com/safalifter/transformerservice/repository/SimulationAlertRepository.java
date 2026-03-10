package com.safalifter.transformerservice.repository;

import com.safalifter.transformerservice.entities.SimulationAlert;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SimulationAlertRepository extends JpaRepository<SimulationAlert, Long> {
}
