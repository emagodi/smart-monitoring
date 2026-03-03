package com.safalifter.transformerservice.service;

import com.safalifter.transformerservice.entities.ControllerReading;
import java.util.List;

public interface ControllerReadingService {
    ControllerReading save(ControllerReading reading);
    List<ControllerReading> getByControllerId(Long controllerId);
}
