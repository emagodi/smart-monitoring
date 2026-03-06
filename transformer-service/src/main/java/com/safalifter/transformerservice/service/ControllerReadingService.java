package com.safalifter.transformerservice.service;

import com.safalifter.transformerservice.entities.ControllerReading;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface ControllerReadingService {
    ControllerReading save(ControllerReading reading);
    List<ControllerReading> getByControllerId(Long controllerId);
    Page<ControllerReading> getByControllerId(Long controllerId, Pageable pageable);
    List<ControllerReading> getByControllerIdAndDateRange(Long controllerId, java.time.LocalDateTime start, java.time.LocalDateTime end);
    Page<ControllerReading> getByControllerIdAndDateRange(Long controllerId, java.time.LocalDateTime start, java.time.LocalDateTime end, Pageable pageable);
}
