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
public class DispatchResponse {
    private Long id;
    private Long alertId;
    private Long alertCaseId;
    private Long vehicleId;
    private String vehicleRegistration;
    private String vehicleCallSign;
    private String crewLeadName;
    private String crewLeadPhone;
    private String crewLeadWhatsapp;
    private String crewLeadEmail;
    private String status;
    private String dispatchedByEmail;
    private String dispatchNote;
    private String lastCrewNote;
    private LocalDateTime dispatchedAt;
    private LocalDateTime acceptedAt;
    private LocalDateTime onSceneAt;
    private LocalDateTime completedAt;
    private LocalDateTime cancelledAt;
    /** Link the crew uses to update status; shown to dispatchers so it can be re-sent by hand. */
    private String crewLink;
    private boolean crewNotified;
}
