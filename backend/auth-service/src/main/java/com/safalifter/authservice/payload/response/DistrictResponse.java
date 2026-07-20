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
public class DistrictResponse {
    private Long id;
    private String name;
    private Long regionId;
    private List<DepotResponse> depots;
}