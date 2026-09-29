package com.safalifter.transformerservice.entities;

import com.safalifter.transformerservice.enums.GatewaySyncRunStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(name = "gateway_sync_runs", indexes = {
        @Index(name = "idx_gsr_started_at", columnList = "started_at"),
        @Index(name = "idx_gsr_status", columnList = "status")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GatewaySyncRun {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 32, nullable = false)
    private GatewaySyncRunStatus status;

    @Column(name = "error_summary", length = 2000)
    private String errorSummary;

    @Column(name = "count_created")
    private Integer countCreated;

    @Column(name = "count_updated")
    private Integer countUpdated;

    @Column(name = "count_unchanged")
    private Integer countUnchanged;

    @Column(name = "count_failed")
    private Integer countFailed;

    @CreationTimestamp
    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "finished_at")
    private Instant finishedAt;
}
