package com.safalifter.transformerservice.entities;

import com.safalifter.transformerservice.enums.AlertCaseActivityType;
import com.safalifter.transformerservice.enums.AlertCaseStatus;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "alert_case_activities")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlertCaseActivity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "alert_case_id", nullable = false)
    private Long alertCaseId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AlertCaseActivityType activityType;

    @Enumerated(EnumType.STRING)
    @Column(name = "status_before")
    private AlertCaseStatus statusBefore;

    @Enumerated(EnumType.STRING)
    @Column(name = "status_after")
    private AlertCaseStatus statusAfter;

    @Column(name = "actor_email")
    private String actorEmail;

    @Column(name = "actor_name")
    private String actorName;

    @Column(length = 2000)
    private String note;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
