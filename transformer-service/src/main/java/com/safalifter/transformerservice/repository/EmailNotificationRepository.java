package com.safalifter.transformerservice.repository;

import com.safalifter.transformerservice.entities.EmailNotification;
import com.safalifter.transformerservice.enums.EmailStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface EmailNotificationRepository extends JpaRepository<EmailNotification, Long> {
    List<EmailNotification> findByStatusInAndNextRetryTimeBefore(List<EmailStatus> statuses, LocalDateTime now);
    boolean existsByAlertId(Long alertId);
}
