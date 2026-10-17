package com.safalifter.transformerservice.payload.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlertSummaryResponse {
    private long total;
    private long open;
    private long newCount;
    private long acknowledged;
    private long dispatched;
    private long enRoute;
    private long onScene;
    private long resolved;
    private long falseAlarm;
    private long unassigned;
    private long last24h;
    /** Sum of occurrence_count across alerts (raw trigger events, including folded repeats). */
    private long totalEvents;
    private long transformersWithOpenAlerts;
    private List<MonthlyCount> monthly;
    private long realThreats30d;
    private long falseAlarms30d;
    private long technicalFaults30d;
    /** Average minutes from alert to acknowledgement / dispatch / arrival / closure (last 30 days). */
    private Double avgAcknowledgeMinutes;
    private Double avgDispatchMinutes;
    private Double avgArrivalMinutes;
    private Double avgCloseMinutes;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MonthlyCount {
        private String month;
        private long alerts;
        private long events;
    }
}
