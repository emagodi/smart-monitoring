package com.safalifter.transformerservice.integration.loriot;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.client.DefaultResponseErrorHandler;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class LoriotClientAdapter {

    private final LoriotProperties properties;
    private final RestTemplate restTemplate;

    private final ObjectMapper objectMapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    public List<LoriotGateway> fetchGateways() {
        return executeWithRetry(() -> {
            String primaryPath = properties.getPaths().getGateways();
            List<LoriotGateway> result = fetchGatewaysPaged(primaryPath);
            if (result != null && !result.isEmpty()) {
                log.info("Parsed {} LORIOT gateways from primary path", result.size());
                return result;
            }
            if (properties.getPaths().getGatewaysFallback() != null
                    && !properties.getPaths().getGatewaysFallback().isBlank()) {
                log.warn("Gateway list empty from primary path; attempting fallback");
                String fallback = properties.getPaths().getGatewaysFallback()
                        .replace("{networkId}", properties.getNetworkId());
                List<LoriotGateway> fallbackResult = fetchGatewaysPaged(fallback);
                log.info("Parsed {} LORIOT gateways from fallback path", fallbackResult == null ? 0 : fallbackResult.size());
                return fallbackResult == null ? Collections.emptyList() : fallbackResult;
            }
            return Collections.emptyList();
        });
    }

    private List<LoriotGateway> fetchGatewaysPaged(String path) {
        List<LoriotGateway> accumulator = new ArrayList<>();
        int maxPages = 50;
        int pageSize = 100;
        for (int page = 1; page <= maxPages; page++) {
            String separator = path.contains("?") ? "&" : "?";
            String pageUrl = buildUrl(path) + separator + "perPage=" + pageSize + "&page=" + page;
            if (log.isDebugEnabled()) {
                log.debug("Fetching LORIOT gateways page {} from {}", page, redactUrl(pageUrl));
            }
            if (page == 1) {
                log.info("Fetching LORIOT gateways from {} (paginated perPage={})", redactUrl(buildUrl(path)), pageSize);
            }
            String body = authenticatedGet(pageUrl);
            ParsedPage parsed = parseGatewaysPage(body);
            int pageCount = parsed.items == null ? 0 : parsed.items.size();
            if (pageCount > 0) {
                accumulator.addAll(parsed.items);
            }
            boolean hasMore;
            if (parsed.total != null && parsed.total > 0) {
                long fetchedSoFar = (long) pageSize * (long) page;
                hasMore = fetchedSoFar < parsed.total && pageCount > 0;
            } else if (parsed.totalPages != null && parsed.totalPages > 0) {
                hasMore = page < parsed.totalPages && pageCount > 0;
            } else {
                hasMore = pageCount >= pageSize;
            }
            if (!hasMore) {
                break;
            }
        }
        return accumulator;
    }

    private ParsedPage parseGatewaysPage(String body) {
        ParsedPage out = new ParsedPage();
        try {
            JsonNode root = objectMapper.readTree(body);
            JsonNode items = root.isArray() ? root : (root.has("gateways") ? root.path("gateways") : (root.has("data") ? root.path("data") : root.path("items")));
            List<LoriotGateway> result = new ArrayList<>();
            if (items.isArray()) {
                for (JsonNode node : items) {
                    result.add(mapToLoriotGateway(node));
                }
            }
            out.items = result;
            out.total = firstLong(root, "total", "totalElements", "count", "total_count", "size");
            out.totalPages = firstInt(root, "totalPages", "pages", "pageCount");
            if (out.total == null && root.path("page").isObject()) {
                JsonNode p = root.path("page");
                out.total = firstLong(p, "totalElements", "total", "size");
                out.totalPages = firstInt(p, "totalPages", "pages");
            }
        } catch (Exception e) {
            log.warn("Failed to parse gateway page: {}", e.getMessage());
            out.items = Collections.emptyList();
        }
        return out;
    }

    private Long firstLong(JsonNode node, String... keys) {
        for (String k : keys) {
            JsonNode n = node.path(k);
            if (n != null && !n.isMissingNode() && !n.isNull()) {
                if (n.isNumber()) return n.asLong();
                try {
                    String s = n.asText();
                    if (s != null && !s.isBlank()) return Long.parseLong(s.trim());
                } catch (Exception ignored) {}
            }
        }
        return null;
    }

    private Integer firstInt(JsonNode node, String... keys) {
        for (String k : keys) {
            JsonNode n = node.path(k);
            if (n != null && !n.isMissingNode() && !n.isNull()) {
                if (n.isNumber()) return n.asInt();
                try {
                    String s = n.asText();
                    if (s != null && !s.isBlank()) return Integer.parseInt(s.trim());
                } catch (Exception ignored) {}
            }
        }
        return null;
    }

    private static class ParsedPage {
        List<LoriotGateway> items;
        Long total;
        Integer totalPages;
    }

    public LoriotGateway fetchGatewayDetail(String gatewayId) {
        return executeWithRetry(() -> {
            String path = properties.getPaths().getGatewayDetail().replace("{gatewayId}", gatewayId);
            String url = buildUrl(path);
            log.info("Fetching LORIOT gateway detail from {}", redactUrl(url));
            String body = authenticatedGet(url);
            JsonNode root = objectMapper.readTree(body);
            return mapToLoriotGateway(root);
        });
    }

    private LoriotGateway mapToLoriotGateway(JsonNode node) {
        LoriotGateway g = new LoriotGateway();
        g.setRaw(node);
        g.setId(textOr(node, "id", "_id", "gweui"));
        g.setName(textOr(node, "name", "title", "label"));
        g.setGweui(textOr(node, "gweui", "EUI", "eui", "gwEui", "gatewayEui"));
        g.setMac(textOr(node, "mac", "macAddress", "MAC"));
        g.setSerial(textOr(node, "serial", "serialNumber", "sn"));
        g.setModel(textOr(node, "model", "hwModel", "hw"));
        g.setManufacturer(textOr(node, "manufacturer", "vendor", "brand"));
        g.setFw(textOr(node, "fw", "firmware"));
        g.setFwVersion(textOr(node, "fwVersion", "firmwareVersion", "version"));
        g.setPacketForwarderVersion(textOr(node, "pf", "packetForwarder", "pfVersion"));
        g.setImei(textOr(node, "imei"));
        g.setNetworkId(textOr(node, "network", "networkId", "net"));
        Boolean explicitOnline = boolOrNull(node, "online", "isOnline", "connected");
        g.setOnline(explicitOnline);
        g.setStatus(textOr(node, "status", "state"));
        Long lastSeenMs = longOrNull(node, "lastSeen", "last_seen", "lastSeenAt", "lastAlive");
        if (lastSeenMs != null) {
            g.setLastSeen(Instant.ofEpochMilli(lastSeenMs));
        }
        g.setLatitude(decimalOr(node, "latitude", "lat", "y"));
        g.setLongitude(decimalOr(node, "longitude", "lon", "lng", "x"));
        g.setAltitude(decimalOr(node, "altitude", "alt"));
        g.setAddress(textOr(node, "address", "location", "addr"));
        return g;
    }

    private String authenticatedGet(String url) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set(HttpHeaders.AUTHORIZATION, authHeader());
            headers.set(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE);
            HttpEntity<Void> entity = new HttpEntity<>(headers);
            RestTemplate template = getRestTemplate();
            ResponseEntity<String> response = template.exchange(url, HttpMethod.GET, entity, String.class);
            if (response.getStatusCode().is5xxServerError() || response.getStatusCode() == HttpStatus.TOO_MANY_REQUESTS) {
                throw new HttpServerErrorException(response.getStatusCode(), "Server error from LORIOT");
            }
            return response.getBody();
        } catch (HttpClientErrorException e) {
            if (e.getStatusCode().is4xxClientError() && !e.getStatusCode().equals(HttpStatus.TOO_MANY_REQUESTS)) {
                throw e;
            }
            throw e;
        } catch (RestClientException e) {
            log.error("LORIOT REST call failed for {}", redactUrl(url), e);
            throw e;
        }
    }

    private RestTemplate getRestTemplate() {
        if (restTemplate.getErrorHandler() == null
                || !(restTemplate.getErrorHandler() instanceof LenientErrorHandler)) {
            restTemplate.setErrorHandler(new LenientErrorHandler());
        }
        return restTemplate;
    }

    private String authHeader() {
        String pattern = properties.getUserApiAuthPattern();
        String key = properties.getUserApiKey();
        if (pattern == null || pattern.isBlank()) {
            pattern = "Bearer {}";
        }
        return pattern.replace("{}", key == null ? "" : key);
    }

    private String buildUrl(String path) {
        String base = properties.getBaseUrl();
        if (base == null) base = "";
        if (base.endsWith("/") && path.startsWith("/")) {
            path = path.substring(1);
        }
        if (!base.endsWith("/") && !path.startsWith("/")) {
            path = "/" + path;
        }
        return base + path;
    }

    private <T> T executeWithRetry(ThrowingSupplier<T> supplier) {
        int maxAttempts = Math.max(1, properties.getRetry().getMaxAttempts());
        long delay = Math.max(50L, properties.getRetry().getInitialDelayMs());
        double mult = Math.max(1.1, properties.getRetry().getBackoffMultiplier());
        RuntimeException last = null;
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return supplier.get();
            } catch (RuntimeException e) {
                last = e;
                if (attempt < maxAttempts) {
                    long d = (long) (delay * Math.pow(mult, attempt - 1));
                    log.warn("LORIOT client attempt {}/{} failed; retrying in {}ms", attempt, maxAttempts, d, e);
                    sleep(d);
                }
            } catch (Exception e) {
                last = new RuntimeException(e);
                if (attempt < maxAttempts) {
                    long d = (long) (delay * Math.pow(mult, attempt - 1));
                    log.warn("LORIOT client attempt {}/{} failed; retrying in {}ms", attempt, maxAttempts, d, e);
                    sleep(d);
                }
            }
        }
        throw last != null ? last : new RuntimeException("LORIOT client failed");
    }

    private void sleep(long ms) {
        try {
            Thread.sleep(Math.min(ms, 10_000L));
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        }
    }

    private String textOr(JsonNode node, String... keys) {
        for (String k : keys) {
            JsonNode n = node.path(k);
            if (n != null && !n.isMissingNode() && !n.isNull()) {
                String s = n.asText();
                if (s != null && !s.isBlank()) return s.trim();
            }
        }
        return null;
    }

    private Boolean boolOrNull(JsonNode node, String... keys) {
        for (String k : keys) {
            JsonNode n = node.path(k);
            if (n != null && !n.isMissingNode() && !n.isNull() && n.isBoolean()) {
                return n.asBoolean();
            }
            if (n != null && !n.isMissingNode() && !n.isNull()) {
                String s = n.asText();
                if ("true".equalsIgnoreCase(s)) return true;
                if ("false".equalsIgnoreCase(s)) return false;
            }
        }
        return null;
    }

    private Long longOrNull(JsonNode node, String... keys) {
        for (String k : keys) {
            JsonNode n = node.path(k);
            if (n != null && !n.isMissingNode() && !n.isNull()) {
                if (n.isNumber()) return n.asLong();
                try {
                    String s = n.asText();
                    if (s != null && !s.isBlank()) {
                        return Long.parseLong(s.trim());
                    }
                } catch (Exception ignored) {}
            }
        }
        return null;
    }

    private BigDecimal decimalOr(JsonNode node, String... keys) {
        for (String k : keys) {
            JsonNode n = node.path(k);
            if (n != null && !n.isMissingNode() && !n.isNull()) {
                if (n.isNumber()) return n.decimalValue();
                try {
                    String s = n.asText();
                    if (s != null && !s.isBlank()) {
                        return new BigDecimal(s.trim());
                    }
                } catch (Exception ignored) {}
            }
        }
        return null;
    }

    private String redactUrl(String url) {
        if (url == null) return null;
        int q = url.indexOf('?');
        if (q < 0) return url;
        return url.substring(0, q) + "?***";
    }

    private static class LenientErrorHandler extends DefaultResponseErrorHandler {
        @Override
        public boolean hasError(ClientHttpResponse response) throws IOException {
            HttpStatus s = HttpStatus.resolve(response.getRawStatusCode());
            if (s == null) return false;
            return s.is5xxServerError() || s == HttpStatus.TOO_MANY_REQUESTS;
        }

        @Override
        public void handleError(ClientHttpResponse response) {
        }
    }

    @FunctionalInterface
    private interface ThrowingSupplier<T> {
        T get() throws Exception;
    }
}
