package com.safalifter.transformerservice.payload.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ExternalTransformerLookupResponse {
    private String eui;
    private String transformerName;
    /** Utility transformer number from the partner, or the trailing number of the name ("Warren Park - 2476"). */
    private String transformerNumber;
    private String rawTransformerType;
    private String transformerType;
    private BigDecimal lat;
    private BigDecimal lng;
}
