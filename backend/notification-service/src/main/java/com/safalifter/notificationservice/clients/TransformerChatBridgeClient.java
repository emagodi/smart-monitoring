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

    /** Reaction desk over WhatsApp: OPEN, ACK <id>, ARRIVED <id>, CLOSE <id> REAL|FALSE|FAULT|AUTH. Returns {reply}. */
    @PostMapping("/api/v1/channels/whatsapp")
    java.util.Map<String, Object> reactionCommand(
            @RequestHeader("X-Channel-Key") String channelKey,
            @RequestBody java.util.Map<String, String> request
    );
}
