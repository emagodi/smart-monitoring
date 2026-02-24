package com.safalifter.transformerservice.repository;

import com.safalifter.transformerservice.entities.SensorReading;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface SensorReadingRepository extends JpaRepository<SensorReading, Long> {
    List<SensorReading> findBySensorId(Long sensorId);
    List<SensorReading> findBySensorIdAndCreatedAtBetween(Long sensorId, LocalDateTime start, LocalDateTime end);
    List<SensorReading> findBySensorIdAndUpdatedAtBetween(Long sensorId, LocalDateTime start, LocalDateTime end);
}
