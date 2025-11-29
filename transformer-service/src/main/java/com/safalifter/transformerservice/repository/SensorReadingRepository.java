package com.safalifter.transformerservice.repository;

import com.safalifter.transformerservice.entities.SensorReading;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SensorReadingRepository extends JpaRepository<SensorReading, Long> {
    List<SensorReading> findBySensorId(Long sensorId);
}