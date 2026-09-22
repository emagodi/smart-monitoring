package com.safalifter.transformerservice.entities;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "gateway_transformer_coverage", uniqueConstraints = {
        @UniqueConstraint(name = "uk_gateway_transformer", columnNames = {"gateway_id", "transformer_id"})
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GatewayTransformerCoverage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "gateway_id", nullable = false)
    private Long gatewayId;

    @Column(name = "transformer_id", nullable = false)
    private Long transformerId;

    @Column(name = "notes", length = 500)
    private String notes;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
