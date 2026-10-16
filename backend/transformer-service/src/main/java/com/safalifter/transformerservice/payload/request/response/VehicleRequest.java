package com.safalifter.transformerservice.payload.request.response;

import com.safalifter.transformerservice.enums.VehicleStatus;
import lombok.Data;

@Data
public class VehicleRequest {
    private String registration;
    private String callSign;
    private String vehicleType;
    private Long depotId;
    private String depotName;
    private VehicleStatus status;
    private String crewLeadName;
    private String crewLeadPhone;
    private String crewLeadWhatsapp;
    private String crewLeadEmail;
    private Integer crewSize;
    private String notes;
}
