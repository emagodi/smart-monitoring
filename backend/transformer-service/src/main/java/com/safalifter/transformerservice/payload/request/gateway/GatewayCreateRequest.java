package com.safalifter.transformerservice.payload.request.gateway;

import com.safalifter.transformerservice.enums.GatewayLocationSource;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class GatewayCreateRequest {
    private String loriotGatewayId;
    private String networkId;
    private String name;
    private String description;
    private String gatewayEui;
    private String macAddress;
    private String serialNumber;
    private String imei;
    private String manufacturer;
    private String model;
    private String firmwareVersion;
    private BigDecimal latitude;
    private BigDecimal longitude;
    private BigDecimal altitude;
    private String address;
    private GatewayLocationSource locationSource;
    private String customer;
    private String networkName;
    private String operator;
    private String regionName;
    private String districtName;
    private String depotName;
    private Long regionId;
    private Long districtId;
    private Long depotId;
    private LocalDate commissioningDate;
}
