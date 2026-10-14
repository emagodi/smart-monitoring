package com.safalifter.transformerservice.payload.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Pre-computed alert snapshot for one transformer (row of transformer_alert_state).
 * Reading this never touches the alerts table, so map pins / region rollups stay O(transformers).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TransformerAlertStateResponse {
    private Long transformerId;
    private String transformerName;
    private String supplierCode;
    private Long depotId;
    private int openAlertCount;
    private long totalAlertCount;
    private long totalEventCount;
    private Long lastAlertId;
    private LocalDateTime lastAlertAt;
    private String lastAlertMessage;
    private String lastCaseStatus;
    private List<RecentAlert> recentAlerts;
    private LocalDateTime updatedAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RecentAlert {
        private Long id;
        private String message;
        private String value;
        private String sensorType;
        private String deviceName;
        private Integer occurrenceCount;
        private String caseStatus;
        private LocalDateTime createdAt;
        private LocalDateTime lastSeenAt;
    }
}
