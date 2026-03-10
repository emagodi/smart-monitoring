package com.safalifter.transformerservice.repository;

import com.safalifter.transformerservice.entities.Camera;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CameraRepository extends JpaRepository<Camera, Long> {
    Optional<Camera> findByTopic(String topic);
    List<Camera> findByTransformerId(Long transformerId);
    Optional<Camera> findByIpAddress(String ipAddress);
}
