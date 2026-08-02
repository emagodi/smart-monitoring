package com.safalifter.transformerservice.entities;

import com.safalifter.transformerservice.enums.AlertCaseStatus;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "alert_cases")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlertCase {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "alert_id", nullable = false, unique = true)
    private Long alertId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AlertCaseStatus status;

    @Column(name = "assigned_to_email")
    private String assignedToEmail;

    @Column(name = "assigned_to_name")
    private String assignedToName;

    @Column(name = "assigned_at")
    private LocalDateTime assignedAt;

    @Column(name = "acknowledged_at")
    private LocalDateTime acknowledgedAt;

    @Column(name = "dispatched_at")
    private LocalDateTime dispatchedAt;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @Column(name = "false_alarm_at")
    private LocalDateTime falseAlarmAt;

    @Column(name = "last_action_at")
    private LocalDateTime lastActionAt;

    @Column(name = "last_action_by_email")
    private String lastActionByEmail;

    @Column(name = "last_action_by_name")
    private String lastActionByName;

    @Column(name = "last_action_note", length = 2000)
    private String lastActionNote;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
