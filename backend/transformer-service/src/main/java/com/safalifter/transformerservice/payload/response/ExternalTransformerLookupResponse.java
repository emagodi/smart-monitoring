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
    private String rawTransformerType;
    private String transformerType;
    private BigDecimal lat;
    private BigDecimal lng;
}
