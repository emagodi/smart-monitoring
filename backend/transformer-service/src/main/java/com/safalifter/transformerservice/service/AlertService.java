package com.safalifter.transformerservice.service;

import com.safalifter.transformerservice.payload.request.AlertRequest;
import com.safalifter.transformerservice.payload.request.AlertCaseUpdateRequest;
import com.safalifter.transformerservice.payload.response.AlertCaseActivityResponse;
import com.safalifter.transformerservice.payload.response.AlertResponse;
import org.springframework.data.domain.Page;

import java.util.List;

public interface AlertService {
    AlertResponse create(AlertRequest request);
    AlertResponse getById(Long id);
    Page<AlertResponse> getAll(int page, int size);
    List<AlertResponse> listBySensorId(Long sensorId);
    List<AlertCaseActivityResponse> getTimeline(Long id);
    AlertResponse updateCase(Long id, AlertCaseUpdateRequest request);
    AlertResponse update(Long id, AlertRequest request);
    void delete(Long id);
}
