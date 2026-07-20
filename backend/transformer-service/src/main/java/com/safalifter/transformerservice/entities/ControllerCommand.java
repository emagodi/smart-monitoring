package com.safalifter.transformerservice.entities;

import com.safalifter.transformerservice.enums.ArmState;
import com.safalifter.transformerservice.enums.ControllerCommandAction;
import com.safalifter.transformerservice.enums.ControllerCommandStatus;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "controller_commands")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ControllerCommand {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "controller_id")
    private Long controllerId;

    @Column(name = "transformer_id")
    private Long transformerId;

    @Column(name = "supplier_code")
    private String supplierCode;

    @Column(name = "supplier_name")
    private String supplierName;

    @Enumerated(EnumType.STRING)
    @Column(name = "command_action")
    private ControllerCommandAction action;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_state")
    private ArmState targetState;

    @Enumerated(EnumType.STRING)
    @Column(name = "command_status")
    private ControllerCommandStatus commandStatus;

    private String provider;

    @Lob
    @Column(name = "request_payload", columnDefinition = "LONGTEXT")
    private String requestPayload;

    @Lob
    @Column(name = "response_payload", columnDefinition = "LONGTEXT")
    private String responsePayload;

    @Column(name = "error_message", length = 2000)
    private String errorMessage;

    @Column(name = "requested_by_email")
    private String requestedByEmail;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
