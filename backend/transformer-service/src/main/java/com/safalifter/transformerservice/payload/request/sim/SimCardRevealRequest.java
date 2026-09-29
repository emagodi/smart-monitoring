package com.safalifter.transformerservice.payload.request.sim;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SimCardRevealRequest {
    @NotBlank
    private String reason;
}
