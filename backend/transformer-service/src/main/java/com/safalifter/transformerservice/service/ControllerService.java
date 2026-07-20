package com.safalifter.transformerservice.service;

import com.safalifter.transformerservice.payload.request.ControllerRequest;
import com.safalifter.transformerservice.payload.response.ControllerResponse;

import java.util.List;

public interface ControllerService {
    ControllerResponse create(ControllerRequest request);
    ControllerResponse getById(Long id);
    List<ControllerResponse> getAll();
    List<ControllerResponse> listByTransformerId(Long transformerId);
    ControllerResponse update(Long id, ControllerRequest request);
    void delete(Long id);
}
