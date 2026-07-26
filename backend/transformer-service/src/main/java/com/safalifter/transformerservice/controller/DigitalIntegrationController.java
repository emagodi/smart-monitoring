package com.safalifter.transformerservice.controller;

import com.safalifter.transformerservice.config.ChatCommandUserProfile;
import com.safalifter.transformerservice.config.RemoteUserService;
import com.safalifter.transformerservice.payload.request.ChatCommandRequest;
import com.safalifter.transformerservice.payload.request.ChatCommandSearchRequest;
import com.safalifter.transformerservice.payload.response.ChatCommandResponse;
import com.safalifter.transformerservice.payload.response.ChatCommandSearchResponse;
import com.safalifter.transformerservice.payload.response.DigitalOperatorAccessResponse;
import com.safalifter.transformerservice.service.ChatCommandService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import static org.springframework.http.HttpStatus.FORBIDDEN;

@RestController
@RequestMapping("/api/v1/integrations/digital")
@RequiredArgsConstructor
public class DigitalIntegrationController {

    private final ChatCommandService chatCommandService;
    private final RemoteUserService remoteUserService;

    @Value("${chat.command.bridge-key:}")
    private String bridgeKey;

    @GetMapping("/operators/resolve")
    public ResponseEntity<DigitalOperatorAccessResponse> resolveOperator(
            @RequestHeader(name = "X-Smart-Integration-Key", required = false) String suppliedBridgeKey,
            @RequestParam("contact") String contact
    ) {
        requireBridgeKey(suppliedBridgeKey);
        ChatCommandUserProfile operator = remoteUserService.resolveChatCommandUser(contact);
        return ResponseEntity.ok(toOperatorAccessResponse(operator));
    }

    @PostMapping("/oculus-control/search")
    public ResponseEntity<ChatCommandSearchResponse> searchOculusTransformers(
            @RequestHeader(name = "X-Smart-Integration-Key", required = false) String suppliedBridgeKey,
            @RequestBody ChatCommandSearchRequest request
    ) {
        requireBridgeKey(suppliedBridgeKey);
        return ResponseEntity.ok(chatCommandService.searchOculusTransformers(request));
    }

    @PostMapping("/oculus-control/execute")
    public ResponseEntity<ChatCommandResponse> executeOculusCommand(
            @RequestHeader(name = "X-Smart-Integration-Key", required = false) String suppliedBridgeKey,
            @RequestBody ChatCommandRequest request
    ) {
        requireBridgeKey(suppliedBridgeKey);
        return ResponseEntity.ok(chatCommandService.handleOculusCommand(request));
    }

    private void requireBridgeKey(String suppliedBridgeKey) {
        if (bridgeKey == null || bridgeKey.isBlank() || !bridgeKey.equals(suppliedBridgeKey)) {
            throw new ResponseStatusException(FORBIDDEN, "Invalid smart integration key");
        }
    }

    private DigitalOperatorAccessResponse toOperatorAccessResponse(ChatCommandUserProfile operator) {
        if (operator == null) {
            return DigitalOperatorAccessResponse.builder()
                    .allowedToControl(false)
                    .message("No user was found for the supplied contact.")
                    .build();
        }

        String operatorName = formatOperatorName(operator);
        return DigitalOperatorAccessResponse.builder()
                .userId(operator.getUserId())
                .operatorName(operatorName)
                .email(operator.getEmail())
                .phone(operator.getPhone())
                .whatsappNumber(operator.getWhatsappNumber())
                .status(operator.getStatus())
                .userType(operator.getUserType())
                .supplierCode(operator.getSupplierCode())
                .supplierName(operator.getSupplierName())
                .roles(operator.getRoles())
                .allowedToControl(operator.isAllowedToControl())
                .message(operator.isAllowedToControl()
                        ? "Operator is allowed to control supplier-scoped transformers."
                        : "Operator is not allowed to control transformers.")
                .build();
    }

    private String formatOperatorName(ChatCommandUserProfile operator) {
        String first = operator.getFirstname() == null ? "" : operator.getFirstname().trim();
        String last = operator.getLastname() == null ? "" : operator.getLastname().trim();
        String fullName = (first + " " + last).trim();
        if (!fullName.isBlank()) {
            return fullName;
        }
        return firstNonBlank(operator.getEmail(), operator.getPhone(), operator.getWhatsappNumber(), "Unknown operator");
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return null;
    }
}
