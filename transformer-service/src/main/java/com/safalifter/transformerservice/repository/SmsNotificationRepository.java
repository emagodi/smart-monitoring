package com.safalifter.transformerservice.repository;

import com.safalifter.transformerservice.entities.SmsNotification;
import com.safalifter.transformerservice.enums.SmsStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface SmsNotificationRepository extends JpaRepository<SmsNotification, Long> {
    List<SmsNotification> findByStatusInAndNextRetryTimeBefore(List<SmsStatus> statuses, LocalDateTime now);
    boolean existsByAlertId(Long alertId);
}
