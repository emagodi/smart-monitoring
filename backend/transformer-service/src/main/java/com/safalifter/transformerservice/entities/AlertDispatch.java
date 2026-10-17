package com.safalifter.transformerservice.entities;

import com.safalifter.transformerservice.enums.DispatchStatus;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * One vehicle sent to one incident. A case can have several (e.g. first vehicle recalled,
 * second sent). Vehicle and crew details are snapshotted so history stays correct if the
 * fleet register changes later.
 */
@Entity
@Table(name = "alert_dispatches")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlertDispatch {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "alert_case_id", nullable = false)
    private Long alertCaseId;

    @Column(name = "alert_id", nullable = false)
    private Long alertId;

    @Column(name = "vehicle_id")
    private Long vehicleId;

    @Column(name = "vehicle_registration", length = 32)
    private String vehicleRegistration;

    @Column(name = "vehicle_call_sign", length = 64)
    private String vehicleCallSign;

    @Column(name = "crew_lead_name")
    private String crewLeadName;

    @Column(name = "crew_lead_phone", length = 32)
    private String crewLeadPhone;

    @Column(name = "crew_lead_whatsapp", length = 32)
    private String crewLeadWhatsapp;

    @Column(name = "crew_lead_email")
    private String crewLeadEmail;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private DispatchStatus status;

    /** Random secret in the crew's SMS/WhatsApp link; lets the crew update status without logging in. */
    @Column(name = "crew_token", nullable = false, length = 64, unique = true)
    private String crewToken;

    @Column(name = "dispatched_by_email")
    private String dispatchedByEmail;

    @Column(name = "dispatch_note", length = 1000)
    private String dispatchNote;

    @Column(name = "dispatched_at")
    private LocalDateTime dispatchedAt;

    @Column(name = "accepted_at")
    private LocalDateTime acceptedAt;

    @Column(name = "on_scene_at")
    private LocalDateTime onSceneAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "cancelled_at")
    private LocalDateTime cancelledAt;

    @Column(name = "last_crew_note", length = 1000)
    private String lastCrewNote;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
