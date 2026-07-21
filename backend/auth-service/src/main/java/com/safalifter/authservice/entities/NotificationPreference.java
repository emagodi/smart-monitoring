package com.safalifter.authservice.entities;

import com.safalifter.authservice.enums.NotificationType;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(
        name = "notification_preferences",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_notification_preference_user_type", columnNames = {"user_id", "notification_type"})
        }
)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationPreference {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "notification_type", nullable = false, length = 64)
    private NotificationType notificationType;

    @Column(name = "supplier_code")
    private String supplierCode;

    @Builder.Default
    @Column(name = "email_enabled", nullable = false)
    private boolean emailEnabled = true;

    @Builder.Default
    @Column(name = "sms_enabled", nullable = false)
    private boolean smsEnabled = false;

    @Builder.Default
    @Column(name = "whatsapp_enabled", nullable = false)
    private boolean whatsappEnabled = false;

    @Builder.Default
    @Column(name = "all_channels_enabled", nullable = false)
    private boolean allChannelsEnabled = false;

    @Builder.Default
    @Column(name = "muted", nullable = false)
    private boolean muted = false;
}
