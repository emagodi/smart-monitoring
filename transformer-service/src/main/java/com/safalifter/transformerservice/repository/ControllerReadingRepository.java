package com.safalifter.transformerservice.repository;

import com.safalifter.transformerservice.entities.ControllerReading;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ControllerReadingRepository extends JpaRepository<ControllerReading, Long> {
    List<ControllerReading> findByControllerId(Long controllerId);
    List<ControllerReading> findByControllerIdAndCreatedAtBetween(Long controllerId, LocalDateTime start, LocalDateTime end);
    Optional<ControllerReading> findTopByControllerIdOrderByCreatedAtDesc(Long controllerId);
}
