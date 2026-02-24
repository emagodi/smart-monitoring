package com.safalifter.transformerservice.payload.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TransformerResponse {
    private Long id;
    private String name;
    private Integer capacity;
    private Boolean isActive;
    private Long depotId;
    private BigDecimal lat;
    private BigDecimal lng;
    private List<SensorResponse> sensors;
}