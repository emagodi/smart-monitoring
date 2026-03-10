package com.safalifter.transformerservice.service;

import com.safalifter.transformerservice.payload.request.TransformerRequest;
import com.safalifter.transformerservice.payload.response.TransformerResponse;

import java.util.List;

public interface TransformerService {
    TransformerResponse create(TransformerRequest request);
    TransformerResponse getById(Long id);
    List<TransformerResponse> getAll();
    List<TransformerResponse> listByDepotId(Long depotId);
    TransformerResponse update(Long id, TransformerRequest request);
    void delete(Long id);
}