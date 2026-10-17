package com.safalifter.transformerservice.payload.response.response;

import com.safalifter.transformerservice.payload.response.AlertResponse;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ResponseBoardResponse {
    private List<BoardCase> open;
    private List<BoardCase> recentlyClosed;
    private int vehiclesAvailable;
    private int vehiclesDispatched;
    private int vehiclesOutOfService;
    private LocalDateTime generatedAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BoardCase {
        private AlertResponse alert;
        private List<DispatchResponse> dispatches;
    }
}
