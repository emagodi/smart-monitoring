package com.safalifter.transformerservice.service.impl;

import com.safalifter.transformerservice.entities.ControllerReading;
import com.safalifter.transformerservice.repository.ControllerReadingRepository;
import com.safalifter.transformerservice.service.ControllerReadingService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
@RequiredArgsConstructor
public class ControllerReadingServiceImpl implements ControllerReadingService {

    private final ControllerReadingRepository repository;

    @Override
    public ControllerReading save(ControllerReading reading) {
        return repository.save(reading);
    }

    @Override
    public List<ControllerReading> getByControllerId(Long controllerId) {
        return repository.findByControllerId(controllerId);
    }
}
