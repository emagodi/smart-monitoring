package com.safalifter.transformerservice.payload.request.gateway;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class GatewayDecommissionRequest {
    @NotBlank
    private String reason;
}
