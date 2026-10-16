package com.safalifter.transformerservice.entities;

import com.safalifter.transformerservice.enums.VehicleStatus;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/** A rapid-response vehicle (ZESA loss-control fleet), stationed at a depot. */
@Entity
@Table(name = "response_vehicles")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ResponseVehicle {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "registration", nullable = false, length = 32)
    private String registration;

    /** Radio call sign / unit name, e.g. "RR-HRE-01". */
    @Column(name = "call_sign", length = 64)
    private String callSign;

    @Column(name = "vehicle_type", length = 64)
    private String vehicleType;

    @Column(name = "depot_id")
    private Long depotId;

    @Column(name = "depot_name")
    private String depotName;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    @Builder.Default
    private VehicleStatus status = VehicleStatus.AVAILABLE;

    @Column(name = "crew_lead_name")
    private String crewLeadName;

    @Column(name = "crew_lead_phone", length = 32)
    private String crewLeadPhone;

    @Column(name = "crew_lead_whatsapp", length = 32)
    private String crewLeadWhatsapp;

    @Column(name = "crew_lead_email")
    private String crewLeadEmail;

    @Column(name = "crew_size")
    private Integer crewSize;

    @Column(name = "notes", length = 1000)
    private String notes;

    @Column(name = "active", nullable = false)
    @Builder.Default
    private boolean active = true;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
