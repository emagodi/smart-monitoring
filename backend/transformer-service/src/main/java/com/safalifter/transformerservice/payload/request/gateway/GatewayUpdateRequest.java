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
    private String networkId;
    private String networkName;
    private String operator;
    private Long regionId;
    private String regionName;
    private Long districtId;
    private String districtName;
    private Long depotId;
    private String depotName;
    private LocalDate commissioningDate;
    private Boolean locationVerified;
}
