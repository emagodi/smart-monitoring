package com.safalifter.transformerservice.clients;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import com.safalifter.transformerservice.payload.client.SendNotificationRequest;

@FeignClient(name = "notification-service", path = "/v1/notification")
public interface NotificationClient {
    @PostMapping("/send")
    void send(@RequestBody SendNotificationRequest request);
}