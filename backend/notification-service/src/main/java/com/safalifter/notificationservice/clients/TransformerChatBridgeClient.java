package com.safalifter.notificationservice.clients;

import com.safalifter.notificationservice.payload.chat.ChatCommandBridgeRequest;
import com.safalifter.notificationservice.payload.chat.ChatCommandBridgeResponse;
import com.safalifter.notificationservice.payload.chat.ChatCommandSearchBridgeRequest;
import com.safalifter.notificationservice.payload.chat.ChatCommandSearchBridgeResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;

@FeignClient(name = "transformer-service")
public interface TransformerChatBridgeClient {

    @PostMapping("/api/v1/chat-commands/oculus/search")
    ChatCommandSearchBridgeResponse searchOculusTransformers(
            @RequestHeader("X-Chat-Bridge-Key") String bridgeKey,
            @RequestBody ChatCommandSearchBridgeRequest request
    );

    @PostMapping("/api/v1/chat-commands/oculus")
    ChatCommandBridgeResponse handleOculusCommand(
            @RequestHeader("X-Chat-Bridge-Key") String bridgeKey,
            @RequestBody ChatCommandBridgeRequest request
    );
}
