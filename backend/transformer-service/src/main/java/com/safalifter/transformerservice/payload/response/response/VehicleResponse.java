package com.safalifter.transformerservice.payload.response.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VehicleResponse {
    private Long id;
    private String registration;
    private String callSign;
    private String vehicleType;
    private Long depotId;
    private String depotName;
    private String status;
    private String crewLeadName;
    private String crewLeadPhone;
    private String crewLeadWhatsapp;
    private String crewLeadEmail;
    private Integer crewSize;
    private String notes;
    /** Set while the vehicle is on a job. */
    private Long currentAlertId;
    private String currentTransformerName;
    private String currentDispatchStatus;
    private LocalDateTime currentDispatchedAt;
    private LocalDateTime updatedAt;
}
