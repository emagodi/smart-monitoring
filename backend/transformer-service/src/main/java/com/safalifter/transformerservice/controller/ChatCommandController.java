package com.safalifter.transformerservice.controller;

import com.safalifter.transformerservice.payload.request.ChatCommandRequest;
import com.safalifter.transformerservice.payload.request.ChatCommandSearchRequest;
import com.safalifter.transformerservice.payload.response.ChatCommandResponse;
import com.safalifter.transformerservice.payload.response.ChatCommandSearchResponse;
import com.safalifter.transformerservice.service.ChatCommandService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.FORBIDDEN;

@RestController
@RequestMapping("/api/v1/chat-commands")
@RequiredArgsConstructor
public class ChatCommandController {

    private final ChatCommandService chatCommandService;

    @Value("${chat.command.bridge-key:}")
    private String bridgeKey;

    @PostMapping("/oculus")
    public ResponseEntity<ChatCommandResponse> handleOculusCommand(
            @RequestHeader(name = "X-Chat-Bridge-Key", required = false) String suppliedBridgeKey,
            @RequestBody ChatCommandRequest request
    ) {
        if (bridgeKey == null || bridgeKey.isBlank() || !bridgeKey.equals(suppliedBridgeKey)) {
            throw new ResponseStatusException(FORBIDDEN, "Invalid chat bridge key");
        }
        return ResponseEntity.ok(chatCommandService.handleOculusCommand(request));
    }

    @PostMapping("/oculus/search")
    public ResponseEntity<ChatCommandSearchResponse> searchOculusTransformers(
            @RequestHeader(name = "X-Chat-Bridge-Key", required = false) String suppliedBridgeKey,
            @RequestBody ChatCommandSearchRequest request
    ) {
        if (bridgeKey == null || bridgeKey.isBlank() || !bridgeKey.equals(suppliedBridgeKey)) {
            throw new ResponseStatusException(FORBIDDEN, "Invalid chat bridge key");
        }
        return ResponseEntity.ok(chatCommandService.searchOculusTransformers(request));
    }
}
