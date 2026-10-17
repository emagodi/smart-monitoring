package com.safalifter.transformerservice.service;

import com.safalifter.transformerservice.payload.request.AlertRequest;
import com.safalifter.transformerservice.payload.request.AlertCaseUpdateRequest;
import com.safalifter.transformerservice.payload.response.AlertCaseActivityResponse;
import com.safalifter.transformerservice.payload.response.AlertRaiseResult;
import com.safalifter.transformerservice.payload.response.AlertResponse;
import com.safalifter.transformerservice.payload.response.AlertSummaryResponse;
import com.safalifter.transformerservice.payload.response.TransformerAlertStateResponse;
import org.springframework.data.domain.Page;

import java.util.List;

public interface AlertService {
    /** Always inserts a new alert (manual/API creation). */
    AlertResponse create(AlertRequest request);

    /**
     * Used by device ingest: folds the event into the open alert for the same
     * transformer + device when one exists, otherwise creates a new alert.
     */
    AlertRaiseResult raise(AlertRequest request);

    AlertResponse getById(Long id);
    Page<AlertResponse> getAll(int page, int size);
    Page<AlertResponse> search(int page, int size, String status, Long transformerId, String query);
    AlertSummaryResponse summary();
    List<TransformerAlertStateResponse> transformerStates(boolean openOnly);
    TransformerAlertStateResponse transformerState(Long transformerId);
    int rebuildTransformerStates();
    List<AlertCaseActivityResponse> getTimeline(Long id);
    AlertResponse updateCase(Long id, AlertCaseUpdateRequest request);
    AlertResponse update(Long id, AlertRequest request);
    void delete(Long id);
}
