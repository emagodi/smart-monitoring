package com.safalifter.notificationservice.repository;

import com.safalifter.notificationservice.enums.NotificationType;
import com.safalifter.notificationservice.model.WhatsAppTemplateCatalog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WhatsAppTemplateCatalogRepository extends JpaRepository<WhatsAppTemplateCatalog, Long> {
    Optional<WhatsAppTemplateCatalog> findFirstByNotificationTypeAndEnabledTrueOrderByDefaultTemplateDescIdAsc(NotificationType notificationType);

    Optional<WhatsAppTemplateCatalog> findFirstByDefaultTemplateTrueAndEnabledTrueOrderByIdAsc();

    List<WhatsAppTemplateCatalog> findAllByOrderByNotificationTypeAscTemplateNameAsc();
}
