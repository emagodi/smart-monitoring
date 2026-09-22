package com.safalifter.transformerservice.entities;

import com.safalifter.transformerservice.enums.SimCardStatus;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "sim_cards", uniqueConstraints = {
        @UniqueConstraint(name = "uk_sim_cards_normalized_iccid", columnNames = {"normalized_iccid"}),
        @UniqueConstraint(name = "uk_sim_cards_normalized_imsi", columnNames = {"normalized_imsi"})
}, indexes = {
        @Index(name = "idx_sim_cards_status", columnList = "status"),
        @Index(name = "idx_sim_cards_msisdn", columnList = "msisdn"),
        @Index(name = "idx_sim_cards_operator", columnList = "operator")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SimCard {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "msisdn", length = 32)
    private String msisdn;

    @Column(name = "iccid", length = 64)
    private String iccid;

    @Column(name = "normalized_iccid", length = 32)
    private String normalizedIccid;

    @Column(name = "imsi", length = 64)
    private String imsi;

    @Column(name = "normalized_imsi", length = 32)
    private String normalizedImsi;

    @Column(name = "operator", length = 128)
    private String operator;

    @Column(name = "apn", length = 128)
    private String apn;

    @Column(name = "encrypted_pin", length = 512)
    private String encryptedPin;

    @Column(name = "encrypted_puk", length = 512)
    private String encryptedPuk;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 32)
    private SimCardStatus status;

    @Column(name = "data_plan_gb", precision = 10, scale = 2)
    private BigDecimal dataPlanGb;

    @Column(name = "allowance_gb", precision = 10, scale = 2)
    private BigDecimal allowanceGb;

    @Column(name = "activation_date")
    private LocalDate activationDate;

    @Column(name = "expiry_date")
    private LocalDate expiryDate;

    @Column(name = "notes", length = 1000)
    private String notes;

    @Column(name = "created_by", length = 255)
    private String createdBy;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_by", length = 255)
    private String updatedBy;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Version
    @Column(name = "version")
    private Long version;
}
