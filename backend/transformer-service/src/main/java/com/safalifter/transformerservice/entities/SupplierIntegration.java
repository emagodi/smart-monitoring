package com.safalifter.transformerservice.entities;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * One telemetry feed from one partner: how to receive it (LORIOT app websocket or HTTP push)
 * and which decoder turns its payload into door / motion / vibration events.
 */
@Entity
@Table(name = "supplier_integrations")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SupplierIntegration {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "supplier_code", nullable = false, length = 64)
    private String supplierCode;

    @Column(name = "supplier_name")
    private String supplierName;

    /** Short label, e.g. "Oculus LORIOT app (Harare)". */
    @Column(name = "name", nullable = false)
    private String name;

    /** LORIOT_WEBSOCKET or HTTP_PUSH. */
    @Column(name = "transport", nullable = false, length = 32)
    private String transport;

    /** wss://... for LORIOT_WEBSOCKET (includes the app token; never returned unmasked by the API). */
    @Column(name = "endpoint_url", length = 1000)
    private String endpointUrl;

    /** Shared secret an HTTP_PUSH sender must present (?key=... or X-Integration-Key). */
    @Column(name = "push_secret", length = 128)
    private String pushSecret;

    @Column(name = "decoder_key", nullable = false, length = 64)
    private String decoderKey;

    /** Device type stored on auto-registered controllers, e.g. DRAGINO_LT22222. */
    @Column(name = "default_controller_type", length = 64)
    private String defaultControllerType;

    /** Create a controller automatically the first time an unknown device EUI reports. */
    @Column(name = "auto_register", nullable = false)
    @Builder.Default
    private boolean autoRegister = true;

    @Column(name = "enabled", nullable = false)
    @Builder.Default
    private boolean enabled = true;

    @Column(name = "status", length = 32)
    private String status;

    @Column(name = "last_error", length = 1000)
    private String lastError;

    @Column(name = "last_connected_at")
    private LocalDateTime lastConnectedAt;

    @Column(name = "last_message_at")
    private LocalDateTime lastMessageAt;

    @Column(name = "messages_received", nullable = false)
    @Builder.Default
    private long messagesReceived = 0;

    @Column(name = "devices_registered", nullable = false)
    @Builder.Default
    private long devicesRegistered = 0;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
