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
public class DepotRequest {
    @NotBlank(message = "name is required")
    private String name;
    @NotNull(message = "districtId is required")
    private Long districtId;
}