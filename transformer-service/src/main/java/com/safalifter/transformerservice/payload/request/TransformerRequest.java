package com.safalifter.transformerservice.payload.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TransformerRequest {
    @NotBlank(message = "name is required")
    private String name;
    @NotNull(message = "capacity is required")
    private Integer capacity;
    @NotNull(message = "isActive is required")
    private Boolean isActive;
    @NotNull(message = "depotId is required")
    private Long depotId;
    private BigDecimal lat;
    private BigDecimal lng;
}