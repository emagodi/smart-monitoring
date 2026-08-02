package com.safalifter.notificationservice.clients;

import com.safalifter.notificationservice.enums.NotificationType;
import com.safalifter.notificationservice.payload.NotificationRecipientResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.util.List;

@FeignClient(name = "auth-service")
public interface AuthRoutingClient {

    @GetMapping("/api/v1/auth/internal/notification-routing/users")
    List<NotificationRecipientResponse> getNotificationRecipients(
            @RequestParam("notificationType") NotificationType notificationType,
            @RequestParam(value = "supplierCode", required = false) String supplierCode,
            @RequestParam(value = "depotId", required = false) Long depotId
    );
}
