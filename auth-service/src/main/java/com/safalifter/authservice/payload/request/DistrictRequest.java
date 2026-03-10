package com.safalifter.authservice.payload.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DistrictRequest {
    @NotBlank(message = "name is required")
    private String name;
    @NotNull(message = "regionId is required")
    private Long regionId;
}