package com.safalifter.transformerservice.entities;

import com.safalifter.transformerservice.enums.GatewayStatus;
import com.safalifter.transformerservice.enums.GatewayStatusSource;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "gateway_status_history", indexes = {
        @Index(name = "idx_gsh_gateway_id", columnList = "gateway_id"),
        @Index(name = "idx_gsh_observed_at", columnList = "observed_at")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GatewayStatusHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "gateway_id", nullable = false)
    private Long gatewayId;

    @Enumerated(EnumType.STRING)
    @Column(name = "prev_status", length = 32)
    private GatewayStatus prevStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "new_status", length = 32)
    private GatewayStatus newStatus;

    @Column(name = "reason", length = 500)
    private String reason;

    @Enumerated(EnumType.STRING)
    @Column(name = "source", length = 32)
    private GatewayStatusSource source;

    @Column(name = "observed_at")
    private Instant observedAt;
}
