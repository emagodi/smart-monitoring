package com.safalifter.transformerservice.payload.response.sim;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SimImportResponse {
    private int received;
    private int created;
    private int updated;
    private int unchanged;
    private int skipped;
    @Builder.Default
    private List<RowIssue> issues = new ArrayList<>();

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class RowIssue {
        private Integer rowNumber;
        private String iccidTail;
        private String message;
    }
}
