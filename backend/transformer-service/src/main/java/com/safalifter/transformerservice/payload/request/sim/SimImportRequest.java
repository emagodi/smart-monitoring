package com.safalifter.transformerservice.payload.request.sim;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * Bulk SIM inventory load from an operator spreadsheet (parsed in the browser). PIN/PUK are never in these files;
 * they are captured later, when the SIM is assigned to a gateway.
 */
@Data
public class SimImportRequest {
    /** Used when a row has no operator / company column. */
    private String defaultOperator;
    private List<Row> rows = new ArrayList<>();

    @Data
    public static class Row {
        /** 1-based row number in the source sheet, echoed back in errors. */
        private Integer rowNumber;
        private String iccid;
        private String imsi;
        private String msisdn;
        private String operator;
        private String networkName;
        private String simType;
        /** Operator state, e.g. "Active", "Suspended". */
        private String state;
        private String notes;
    }
}
