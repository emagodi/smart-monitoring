package com.safalifter.authservice.payload.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RegionResponse {
    private Long id;
    private String name;
    private List<DistrictResponse> districts;
}