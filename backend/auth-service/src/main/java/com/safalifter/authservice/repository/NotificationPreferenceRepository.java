package com.safalifter.authservice.repository;

import com.safalifter.authservice.entities.NotificationPreference;
import com.safalifter.authservice.enums.NotificationType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface NotificationPreferenceRepository extends JpaRepository<NotificationPreference, Long> {
    List<NotificationPreference> findAllByUserIdOrderByNotificationTypeAsc(Long userId);

    List<NotificationPreference> findAllByNotificationType(NotificationType notificationType);
}
