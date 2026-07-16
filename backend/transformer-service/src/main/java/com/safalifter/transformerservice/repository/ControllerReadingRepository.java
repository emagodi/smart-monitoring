package com.safalifter.transformerservice.repository;

import com.safalifter.transformerservice.entities.ControllerReading;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ControllerReadingRepository extends JpaRepository<ControllerReading, Long> {
    List<ControllerReading> findByControllerId(Long controllerId);
    Page<ControllerReading> findByControllerId(Long controllerId, Pageable pageable);
    List<ControllerReading> findByControllerIdAndCreatedAtBetween(Long controllerId, LocalDateTime start, LocalDateTime end);
    Page<ControllerReading> findByControllerIdAndCreatedAtBetween(Long controllerId, LocalDateTime start, LocalDateTime end, Pageable pageable);
    Optional<ControllerReading> findTopByControllerIdOrderByCreatedAtDesc(Long controllerId);
}
