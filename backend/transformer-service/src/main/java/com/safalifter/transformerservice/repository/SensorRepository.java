package com.safalifter.transformerservice.repository;

import com.safalifter.transformerservice.entities.Sensor;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SensorRepository extends JpaRepository<Sensor, Long> {
    List<Sensor> findByTransformerId(Long transformerId);
    Optional<Sensor> findByTransformerIdAndDeviceId(Long transformerId, String deviceId);
    Optional<Sensor> findByDeviceId(String deviceId);
    Optional<Sensor> findByDevEui(String devEui);
}