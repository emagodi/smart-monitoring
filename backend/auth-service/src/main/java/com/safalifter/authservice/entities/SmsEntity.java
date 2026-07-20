package com.safalifter.authservice.entities;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "sms_queue")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SmsEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String phone;

    @Column(length = 160)
    private String message;

    private boolean sent;

    private int retryCount;

    private LocalDateTime createdAt;

    private LocalDateTime sentAt;
}

