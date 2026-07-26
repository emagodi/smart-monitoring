package com.safalifter.notificationservice.repository;

import com.safalifter.notificationservice.model.Notification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface NotificationRepository extends JpaRepository<Notification, String> {
    List<Notification> findAllByUserIdOrderByCreationTimestampDesc(String id);

    Optional<Notification> findTopByProviderMessageIdOrderByCreationTimestampDesc(String providerMessageId);
}
