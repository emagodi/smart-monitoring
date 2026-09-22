package com.safalifter.transformerservice.payload.request.gateway;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class GatewayUpdateRequest {
    private String name;
    private String description;
    private BigDecimal latitude;
    private BigDecimal longitude;
    private BigDecimal altitude;
    private String address;
    private String customer;
    private Long regionId;
    private Long districtId;
    private Long depotId;
    private LocalDate commissioningDate;
    private Boolean locationVerified;
}
