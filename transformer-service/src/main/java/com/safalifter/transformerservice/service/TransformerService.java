package com.safalifter.transformerservice.service;

import com.safalifter.transformerservice.payload.request.TransformerRequest;
import com.safalifter.transformerservice.payload.response.TransformerResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface TransformerService {
    TransformerResponse create(TransformerRequest request);
    TransformerResponse getById(Long id);
    Page<TransformerResponse> getAll(String search, Pageable pageable);
    List<TransformerResponse> listByDepotId(Long depotId);
    TransformerResponse update(Long id, TransformerRequest request);
    void delete(Long id);
}