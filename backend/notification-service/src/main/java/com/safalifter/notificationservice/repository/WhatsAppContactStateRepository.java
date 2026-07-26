package com.safalifter.notificationservice.repository;

import com.safalifter.notificationservice.model.WhatsAppContactState;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WhatsAppContactStateRepository extends JpaRepository<WhatsAppContactState, String> {
}
