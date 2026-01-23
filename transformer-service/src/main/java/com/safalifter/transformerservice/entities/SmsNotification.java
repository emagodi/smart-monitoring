package com.safalifter.transformerservice.entities;

import com.safalifter.transformerservice.enums.SmsStatus;
import com.safalifter.transformerservice.handlers.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "sms_notifications")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SmsNotification extends BaseEntity {

    @Column(nullable = false)
    private String phoneNumber;

    @Column(nullable = false, length = 1000)
    private String message;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SmsStatus status;

    @Column(nullable = false)
    private Integer retryCount;

    private LocalDateTime nextRetryTime;

    private Long alertId;
}
