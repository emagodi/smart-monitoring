package com.safalifter.transformerservice.repository;

import com.safalifter.transformerservice.entities.Controller;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ControllerRepository extends JpaRepository<Controller, Long> {
    List<Controller> findByTransformerId(Long transformerId);
    Optional<Controller> findByTransformerIdAndDeviceId(Long transformerId, String deviceId);
    Optional<Controller> findByDeviceId(String deviceId);
    Optional<Controller> findByDevEui(String devEui);
}
