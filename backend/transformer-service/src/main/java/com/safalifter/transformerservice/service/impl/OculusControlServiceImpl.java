package com.safalifter.transformerservice.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.safalifter.transformerservice.config.AccessScopeService;
import com.safalifter.transformerservice.entities.Controller;
import com.safalifter.transformerservice.entities.ControllerCommand;
import com.safalifter.transformerservice.entities.ControllerReading;
import com.safalifter.transformerservice.entities.Transformer;
import com.safalifter.transformerservice.enums.ArmState;
import com.safalifter.transformerservice.enums.ControllerCommandAction;
import com.safalifter.transformerservice.enums.ControllerCommandStatus;
import com.safalifter.transformerservice.payload.response.OculusControlActionResponse;
import com.safalifter.transformerservice.payload.response.OculusTransformerControlResponse;
import com.safalifter.transformerservice.repository.ControllerCommandRepository;
import com.safalifter.transformerservice.repository.ControllerReadingRepository;
import com.safalifter.transformerservice.repository.ControllerRepository;
import com.safalifter.transformerservice.repository.TransformerRepository;
import com.safalifter.transformerservice.service.OculusControlService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

import javax.net.ssl.*;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional
@RequiredArgsConstructor
public class OculusControlServiceImpl implements OculusControlService {

    private static final String OCULUS_SUPPLIER_CODE = "oculus";
    private static final String OCULUS_SUPPLIER_NAME = "Oculus";
    private static final String LORIOT_PROVIDER = "LORIOT";
    private static final String ARM_HEX = "030100";
    private static final String DISARM_HEX = "030000";

    private final TransformerRepository transformerRepository;
    private final ControllerRepository controllerRepository;
    private final ControllerReadingRepository controllerReadingRepository;
    private final ControllerCommandRepository controllerCommandRepository;
    private final AccessScopeService accessScopeService;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${oculus.loriot.api-url:}")
    private String loriotApiUrl;

    @Value("${oculus.loriot.app-id:}")
    private String loriotAppId;

    @Value("${oculus.loriot.api-key:}")
    private String loriotApiKey;

    @Value("${oculus.loriot.downlink-port:2}")
    private int loriotDownlinkPort;

    @Value("${oculus.loriot.downlink-confirmed:false}")
    private boolean loriotDownlinkConfirmed;

    @Value("${oculus.loriot.insecure-ssl:false}")
    private boolean loriotInsecureSsl;

    @Override
    public List<OculusTransformerControlResponse> listTransformers() {
        ensureOculusControlAccess();

        List<Controller> oculusControllers = controllerRepository.findAllBySupplierCode(OCULUS_SUPPLIER_CODE).stream()
                .filter(controller -> controller.getTransformerId() != null)
                .collect(Collectors.toList());

        LinkedHashMap<Long, List<Controller>> controllersByTransformer = new LinkedHashMap<>();
        for (Controller controller : oculusControllers) {
            controllersByTransformer
                    .computeIfAbsent(controller.getTransformerId(), ignored -> new ArrayList<>())
                    .add(controller);
        }

        Map<Long, Transformer> transformersById = transformerRepository.findAllById(controllersByTransformer.keySet()).stream()
                .collect(Collectors.toMap(Transformer::getId, transformer -> transformer));

        return controllersByTransformer.entrySet().stream()
                .map(entry -> buildTransformerResponse(transformersById.get(entry.getKey()), entry.getValue()))
                .filter(Objects::nonNull)
                .sorted(Comparator.comparing(
                        OculusTransformerControlResponse::getTransformerName,
                        Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)
                ))
                .toList();
    }

    @Override
    public OculusControlActionResponse armTransformer(Long transformerId) {
        return sendCommand(transformerId, ControllerCommandAction.ARM, ArmState.ARMED, ARM_HEX);
    }

    @Override
    public OculusControlActionResponse disarmTransformer(Long transformerId) {
        return sendCommand(transformerId, ControllerCommandAction.DISARM, ArmState.DISARMED, DISARM_HEX);
    }

    private OculusTransformerControlResponse buildTransformerResponse(Transformer transformer, List<Controller> controllers) {
        if (transformer == null) {
            return null;
        }

        Controller primaryController = resolvePrimaryController(controllers);
        Optional<ControllerReading> latestReading = primaryController == null
                ? Optional.empty()
                : controllerReadingRepository.findTopByControllerIdOrderByCreatedAtDesc(primaryController.getId());
        Optional<ControllerCommand> latestCommand = controllerCommandRepository.findTopByTransformerIdOrderByCreatedAtDesc(transformer.getId());

        boolean controlAvailable = primaryController != null && isControllableController(primaryController);
        ArmState armState = latestReading.map(this::extractArmState).orElse(ArmState.UNKNOWN);

        return OculusTransformerControlResponse.builder()
                .transformerId(transformer.getId())
                .transformerName(transformer.getName())
                .depotId(transformer.getDepotId())
                .controllerCount(controllers.size())
                .controllerId(primaryController != null ? primaryController.getId() : null)
                .controllerName(primaryController != null ? primaryController.getName() : null)
                .controllerDevEui(primaryController != null ? primaryController.getDevEui() : null)
                .controllerType(primaryController != null ? primaryController.getType() : null)
                .controlAvailable(controlAvailable)
                .availabilityReason(resolveAvailabilityReason(primaryController))
                .armState(armState.name())
                .armed(armState == ArmState.UNKNOWN ? null : armState == ArmState.ARMED)
                .lastTelemetryAt(latestReading.map(reading -> toIso(reading.getCreatedAt())).orElse(null))
                .lastCommandAction(latestCommand.map(command -> command.getAction().name()).orElse(null))
                .lastCommandStatus(latestCommand.map(command -> command.getCommandStatus().name()).orElse(null))
                .lastCommandAt(latestCommand.map(command -> toIso(command.getCreatedAt())).orElse(null))
                .lastCommandRequestedBy(latestCommand.map(ControllerCommand::getRequestedByEmail).orElse(null))
                .supplierCode(OCULUS_SUPPLIER_CODE)
                .supplierName(OCULUS_SUPPLIER_NAME)
                .build();
    }

    private OculusControlActionResponse sendCommand(
            Long transformerId,
            ControllerCommandAction action,
            ArmState targetState,
            String hexPayload
    ) {
        ensureOculusControlAccess();

        Transformer transformer = transformerRepository.findById(transformerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transformer with id " + transformerId + " not found"));

        List<Controller> controllers = controllerRepository.findByTransformerIdAndSupplierCode(transformerId, OCULUS_SUPPLIER_CODE);
        Controller controller = resolvePrimaryController(controllers);
        if (controller == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No Oculus controller linked to transformer " + transformer.getName());
        }
        if (!isControllableController(controller)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Linked Oculus controller cannot be used for arm/disarm");
        }

        validateLoriotConfiguration();

        Map<String, Object> requestBody = new LinkedHashMap<>();
        requestBody.put("cmd", "tx");
        requestBody.put("EUI", controller.getDevEui());
        requestBody.put("port", loriotDownlinkPort);
        requestBody.put("confirmed", loriotDownlinkConfirmed);
        requestBody.put("data", hexPayload);

        ControllerCommand command = ControllerCommand.builder()
                .controllerId(controller.getId())
                .transformerId(transformer.getId())
                .supplierCode(OCULUS_SUPPLIER_CODE)
                .supplierName(OCULUS_SUPPLIER_NAME)
                .action(action)
                .targetState(targetState)
                .commandStatus(ControllerCommandStatus.PENDING)
                .provider(LORIOT_PROVIDER)
                .requestPayload(writeJson(requestBody))
                .requestedByEmail(accessScopeService.getCurrentUserEmail())
                .build();
        command = controllerCommandRepository.save(command);

        try {
            String responseBody = sendLoriotDownlink(controller.getDevEui(), requestBody);

            command.setCommandStatus(ControllerCommandStatus.SENT);
            command.setResponsePayload(responseBody);
            command.setErrorMessage(null);
            controllerCommandRepository.save(command);

            return OculusControlActionResponse.builder()
                    .transformerId(transformer.getId())
                    .transformerName(transformer.getName())
                    .controllerId(controller.getId())
                    .controllerName(controller.getName())
                    .controllerDevEui(controller.getDevEui())
                    .action(action.name())
                    .targetState(targetState.name())
                    .commandStatus(command.getCommandStatus().name())
                    .provider(LORIOT_PROVIDER)
                    .requestedAt(toIso(command.getCreatedAt()))
                    .requestedBy(command.getRequestedByEmail())
                    .responsePayload(command.getResponsePayload())
                    .message(action == ControllerCommandAction.ARM
                            ? "Arm command sent to Oculus controller"
                            : "Disarm command sent to Oculus controller")
                    .build();
        } catch (HttpStatusCodeException ex) {
            command.setCommandStatus(ControllerCommandStatus.FAILED);
            command.setResponsePayload(ex.getResponseBodyAsString());
            command.setErrorMessage(ex.getMessage());
            controllerCommandRepository.save(command);
            throw new ResponseStatusException(ex.getStatusCode(), "Loriot downlink request failed: " + ex.getResponseBodyAsString());
        } catch (Exception ex) {
            command.setCommandStatus(ControllerCommandStatus.FAILED);
            command.setErrorMessage(ex.getMessage());
            controllerCommandRepository.save(command);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Failed to send Loriot downlink: " + ex.getMessage());
        }
    }

    private void ensureOculusControlAccess() {
        String supplierCode = accessScopeService.getCurrentSupplierCode();
        if (supplierCode != null && !OCULUS_SUPPLIER_CODE.equalsIgnoreCase(supplierCode)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Oculus control is only available to Oculus supplier users");
        }
    }

    private void validateLoriotConfiguration() {
        if (isBlank(loriotApiUrl) || isBlank(loriotAppId) || isBlank(loriotApiKey)) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Loriot downlink configuration is incomplete");
        }
    }

    private String sendLoriotDownlink(String devEui, Map<String, Object> requestBody) {
        if (!loriotInsecureSsl) {
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(loriotApiKey);
            headers.setContentType(MediaType.APPLICATION_JSON);

            ResponseEntity<String> response = restTemplate.exchange(
                    buildLoriotDownlinkUrl(devEui),
                    HttpMethod.POST,
                    new HttpEntity<>(requestBody, headers),
                    String.class
            );
            return response.getBody();
        }

        try {
            String payload = writeJson(requestBody);
            URL targetUrl = new URL(buildLoriotDownlinkUrl(devEui));
            HttpURLConnection connection = (HttpURLConnection) targetUrl.openConnection();

            if (connection instanceof HttpsURLConnection secureConnection) {
                SSLContext sslContext = buildTrustAllSslContext();
                secureConnection.setSSLSocketFactory(sslContext.getSocketFactory());
                secureConnection.setHostnameVerifier((hostname, session) -> true);
            }

            connection.setRequestMethod("POST");
            connection.setDoOutput(true);
            connection.setRequestProperty(HttpHeaders.AUTHORIZATION, "Bearer " + loriotApiKey);
            connection.setRequestProperty(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE);

            try (OutputStream outputStream = connection.getOutputStream()) {
                outputStream.write(payload.getBytes(StandardCharsets.UTF_8));
            }

            int statusCode = connection.getResponseCode();
            String responseBody = readResponseBody(
                    statusCode >= 200 && statusCode < 300 ? connection.getInputStream() : connection.getErrorStream()
            );

            if (statusCode >= 200 && statusCode < 300) {
                return responseBody;
            }

            HttpStatus status = HttpStatus.resolve(statusCode);
            throw new ResponseStatusException(
                    status != null ? status : HttpStatus.BAD_GATEWAY,
                    "Loriot downlink request failed: " + responseBody
            );
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Failed to send Loriot downlink: " + ex.getMessage());
        }
    }

    private String buildLoriotDownlinkUrl(String devEui) {
        return UriComponentsBuilder.fromUriString(trimTrailingSlash(loriotApiUrl))
                .pathSegment("1", "rest")
                .build()
                .toUriString();
    }

    private SSLContext buildTrustAllSslContext() throws Exception {
        TrustManager[] trustAllManagers = new TrustManager[]{
                new X509TrustManager() {
                    @Override
                    public void checkClientTrusted(X509Certificate[] chain, String authType) {
                    }

                    @Override
                    public void checkServerTrusted(X509Certificate[] chain, String authType) {
                    }

                    @Override
                    public X509Certificate[] getAcceptedIssuers() {
                        return new X509Certificate[0];
                    }
                }
        };
        SSLContext sslContext = SSLContext.getInstance("TLS");
        sslContext.init(null, trustAllManagers, new SecureRandom());
        return sslContext;
    }

    private String readResponseBody(InputStream stream) throws Exception {
        if (stream == null) {
            return "";
        }
        try (InputStream inputStream = stream) {
            return new String(inputStream.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private Controller resolvePrimaryController(List<Controller> controllers) {
        if (controllers == null || controllers.isEmpty()) {
            return null;
        }
        return controllers.stream()
                .max(Comparator
                        .comparing(this::latestSignalAt, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(Controller::getUpdatedAt, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(Controller::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder())))
                .orElse(null);
    }

    private LocalDateTime latestSignalAt(Controller controller) {
        if (controller == null || controller.getId() == null) {
            return null;
        }
        return controllerReadingRepository.findTopByControllerIdOrderByCreatedAtDesc(controller.getId())
                .map(ControllerReading::getCreatedAt)
                .orElse(null);
    }

    private boolean isControllableController(Controller controller) {
        return controller != null
                && controller.getTransformerId() != null
                && !isBlank(controller.getDevEui())
                && controller.getType() != null
                && controller.getType().toUpperCase(Locale.ROOT).contains("LT22222");
    }

    private String resolveAvailabilityReason(Controller controller) {
        if (controller == null) {
            return "No Oculus controller linked";
        }
        if (isBlank(controller.getDevEui())) {
            return "Controller EUI missing";
        }
        if (controller.getType() == null || !controller.getType().toUpperCase(Locale.ROOT).contains("LT22222")) {
            return "Controller type not yet supported for Loriot arm/disarm";
        }
        return "Ready";
    }

    private ArmState extractArmState(ControllerReading reading) {
        if (reading == null || isBlank(reading.getDecodedPayload())) {
            return ArmState.UNKNOWN;
        }
        try {
            Map<String, Object> decoded = objectMapper.readValue(reading.getDecodedPayload(), new TypeReference<Map<String, Object>>() {});
            Object ro1 = decoded.containsKey("RO1") ? decoded.get("RO1") : decoded.get("ro1");
            if (ro1 instanceof Boolean ro1Boolean) {
                return ro1Boolean ? ArmState.ARMED : ArmState.DISARMED;
            }
            if (ro1 instanceof String ro1String) {
                if ("true".equalsIgnoreCase(ro1String)) {
                    return ArmState.ARMED;
                }
                if ("false".equalsIgnoreCase(ro1String)) {
                    return ArmState.DISARMED;
                }
            }
        } catch (Exception ignored) {
            return ArmState.UNKNOWN;
        }
        return ArmState.UNKNOWN;
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception ex) {
            return String.valueOf(value);
        }
    }

    private String toIso(LocalDateTime value) {
        return value != null ? value.toString() : null;
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String trimTrailingSlash(String value) {
        return value != null && value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }
}
