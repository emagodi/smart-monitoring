package com.safalifter.transformerservice.service.impl;

import com.safalifter.transformerservice.clients.NotificationClient;
import com.safalifter.transformerservice.config.ChatCommandUserProfile;
import com.safalifter.transformerservice.config.RemoteUserService;
import com.safalifter.transformerservice.entities.Controller;
import com.safalifter.transformerservice.entities.Transformer;
import com.safalifter.transformerservice.payload.client.NotificationType;
import com.safalifter.transformerservice.payload.client.SendNotificationRequest;
import com.safalifter.transformerservice.payload.request.ChatCommandRequest;
import com.safalifter.transformerservice.payload.request.ChatCommandSearchRequest;
import com.safalifter.transformerservice.payload.response.ChatCommandResponse;
import com.safalifter.transformerservice.payload.response.ChatCommandSearchResponse;
import com.safalifter.transformerservice.payload.response.ChatCommandTransformerOption;
import com.safalifter.transformerservice.payload.response.OculusControlActionResponse;
import com.safalifter.transformerservice.repository.ControllerRepository;
import com.safalifter.transformerservice.repository.TransformerRepository;
import com.safalifter.transformerservice.service.ChatCommandService;
import com.safalifter.transformerservice.service.OculusControlService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ChatCommandServiceImpl implements ChatCommandService {
    private static final String OCULUS_SUPPLIER_CODE = "oculus";

    private final RemoteUserService remoteUserService;
    private final TransformerRepository transformerRepository;
    private final ControllerRepository controllerRepository;
    private final OculusControlService oculusControlService;
    private final NotificationClient notificationClient;

    @Override
    @Transactional
    public ChatCommandResponse handleOculusCommand(ChatCommandRequest request) {
        if (request == null || request.getTransformerId() == null || request.getAction() == null || request.getSender() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Sender, action, and transformerId are required");
        }

        ChatCommandUserProfile operator = remoteUserService.resolveChatCommandUser(request.getSender());
        if (operator == null || !operator.isAllowedToControl()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Sender is not allowed to control transformers");
        }

        Transformer transformer = transformerRepository.findById(request.getTransformerId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transformer not found"));

        if (isSupplierScoped(operator) && operator.getSupplierCode() != null && transformer.getSupplierCode() != null
                && !operator.getSupplierCode().equalsIgnoreCase(transformer.getSupplierCode())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Supplier user cannot control another supplier's transformer");
        }

        String normalizedAction = request.getAction().trim().toUpperCase(Locale.ROOT);
        try {
            OculusControlActionResponse response = switch (normalizedAction) {
                case "ARM" -> oculusControlService.armTransformer(transformer.getId());
                case "DISARM" -> oculusControlService.disarmTransformer(transformer.getId());
                default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported action: " + request.getAction());
            };

            sendCommandNotification(transformer, normalizedAction, true, operator, response.getMessage());

            return ChatCommandResponse.builder()
                    .status("ACCEPTED")
                    .result("ACCEPTED")
                    .action(normalizedAction)
                    .transformerId(transformer.getId())
                    .transformerName(transformer.getName())
                    .supplierCode(transformer.getSupplierCode())
                    .operatorName(formatOperatorName(operator))
                    .providerStatus(response.getCommandStatus())
                    .message(response.getMessage())
                    .statusMessage(response.getMessage())
                    .detail(response.getMessage())
                    .build();
        } catch (ResponseStatusException ex) {
            sendCommandNotification(transformer, normalizedAction, false, operator, ex.getReason());
            throw ex;
        } catch (Exception ex) {
            sendCommandNotification(transformer, normalizedAction, false, operator, ex.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, ex.getMessage(), ex);
        }
    }

    @Override
    public ChatCommandSearchResponse searchOculusTransformers(ChatCommandSearchRequest request) {
        if (request == null || request.getSender() == null || request.getAction() == null || request.getQuery() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Sender, action, and query are required");
        }

        String query = request.getQuery().trim();
        if (query.length() < 2) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Query must be at least 2 characters");
        }

        ChatCommandUserProfile operator = remoteUserService.resolveChatCommandUser(request.getSender());
        if (operator == null || !operator.isAllowedToControl()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Sender is not allowed to control transformers");
        }

        String normalizedAction = request.getAction().trim().toUpperCase(Locale.ROOT);
        if (!"ARM".equals(normalizedAction) && !"DISARM".equals(normalizedAction)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported action: " + request.getAction());
        }

        List<Transformer> candidates = isSupplierScoped(operator) && operator.getSupplierCode() != null
                ? transformerRepository.findTop10BySupplierCodeAndNameContainingIgnoreCaseOrderByNameAsc(operator.getSupplierCode(), query)
                : transformerRepository.findTop10ByNameContainingIgnoreCaseOrderByNameAsc(query);

        List<ChatCommandTransformerOption> options = new ArrayList<>();
        for (Transformer transformer : candidates) {
            if (transformer == null || transformer.getId() == null) {
                continue;
            }
            if (isSupplierScoped(operator)
                    && operator.getSupplierCode() != null
                    && transformer.getSupplierCode() != null
                    && !operator.getSupplierCode().equalsIgnoreCase(transformer.getSupplierCode())) {
                continue;
            }
            List<Controller> controllers = controllerRepository.findByTransformerIdAndSupplierCode(transformer.getId(), OCULUS_SUPPLIER_CODE);
            if (controllers == null || controllers.isEmpty()) {
                continue;
            }
            Controller controller = resolvePrimaryController(controllers);
            if (controller == null) {
                continue;
            }
            options.add(ChatCommandTransformerOption.builder()
                    .transformerId(transformer.getId())
                    .id(transformer.getId())
                    .transformerName(transformer.getName())
                    .name(transformer.getName())
                    .depotId(transformer.getDepotId())
                    .supplierCode(transformer.getSupplierCode())
                    .supplierName(transformer.getSupplierName())
                    .controllable(true)
                    .controllerName(controller.getName())
                    .controllerDevEui(controller.getDevEui())
                    .build());
        }

        options.sort(Comparator.comparing(
                ChatCommandTransformerOption::getTransformerName,
                Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)
        ));

        return ChatCommandSearchResponse.builder()
                .status(options.isEmpty() ? "NO_MATCH" : "MATCHES_FOUND")
                .action(normalizedAction)
                .operatorName(formatOperatorName(operator))
                .message(options.isEmpty()
                        ? "No controllable transformers matched your search."
                        : "Select one of the matching transformers to continue.")
                .options(options)
                .build();
    }

    private void sendCommandNotification(Transformer transformer, String action, boolean success,
                                         ChatCommandUserProfile operator, String providerMessage) {
        NotificationType notificationType = switch (action) {
            case "ARM" -> success ? NotificationType.ARM_SUCCESS : NotificationType.ARM_FAILED;
            case "DISARM" -> success ? NotificationType.DISARM_SUCCESS : NotificationType.DISARM_FAILED;
            default -> NotificationType.SYSTEM_NOTICE;
        };

        String message = String.format("%s command %s for transformer %s by %s. %s",
                action,
                success ? "succeeded" : "failed",
                transformer.getName(),
                formatOperatorName(operator),
                providerMessage == null ? "" : providerMessage).trim();

        try {
            notificationClient.send(SendNotificationRequest.builder()
                    .notificationType(notificationType)
                    .supplierCode(transformer.getSupplierCode())
                    .sourceSystem("chat-bridge")
                    .referenceId(String.valueOf(transformer.getId()))
                    .subject("Transformer " + action + " command")
                    .message(message)
                    .build());
        } catch (Exception ignored) {
        }
    }

    private boolean isSupplierScoped(ChatCommandUserProfile operator) {
        return operator.getUserType() != null && "supplier".equalsIgnoreCase(operator.getUserType());
    }

    private Controller resolvePrimaryController(List<Controller> controllers) {
        if (controllers == null || controllers.isEmpty()) {
            return null;
        }
        return controllers.stream()
                .filter(controller -> controller.getDevEui() != null && !controller.getDevEui().isBlank())
                .findFirst()
                .orElse(controllers.get(0));
    }

    private String formatOperatorName(ChatCommandUserProfile operator) {
        String fullName = ((operator.getFirstname() == null ? "" : operator.getFirstname()) + " "
                + (operator.getLastname() == null ? "" : operator.getLastname())).trim();
        return fullName.isBlank() ? firstNonBlank(operator.getEmail(), operator.getPhone(), operator.getWhatsappNumber(), "Unknown operator") : fullName;
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
