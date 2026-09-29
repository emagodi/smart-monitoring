package com.safalifter.transformerservice.entities;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.time.LocalDateTime;

@Entity
@Table(name = "gateway_sim_assignments", indexes = {
        @Index(name = "idx_gsa_gateway_id", columnList = "gateway_id"),
        @Index(name = "idx_gsa_sim_id", columnList = "sim_id"),
        @Index(name = "idx_gsa_active", columnList = "active")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GatewaySimAssignment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "gateway_id", nullable = false)
    private Long gatewayId;

    @Column(name = "sim_id", nullable = false)
    private Long simId;

    @Column(name = "slot_number")
    private Integer slotNumber;

    @Column(name = "active")
    private Boolean active;

    @Column(name = "assigned_at")
    private Instant assignedAt;

    @Column(name = "unassigned_at")
    private Instant unassignedAt;

    @Column(name = "assigned_by", length = 255)
    private String assignedBy;

    @Column(name = "unassigned_by", length = 255)
    private String unassignedBy;

    @Column(name = "reason", length = 500)
    private String reason;

    @Column(name = "notes", length = 1000)
    private String notes;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
