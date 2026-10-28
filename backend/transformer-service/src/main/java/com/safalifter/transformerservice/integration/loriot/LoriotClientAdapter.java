package com.safalifter.transformerservice.integration.loriot;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
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
import java.util.Locale;

@Component
@RequiredArgsConstructor
@Slf4j
public class LoriotClientAdapter {

    private final LoriotProperties properties;
    private final RestTemplate restTemplate;

    /**
     * Positions LORIOT reports for gateways whose real location was never set (a default point in Switzerland).
     * "lat,lon;lat,lon". Such values are treated as "location not set", never stored as the gateway's location.
     */
    @Value("${loriot.placeholder-locations:46.807689,7.100528}")
    private String placeholderLocations;

    private volatile List<double[]> placeholders;

    public boolean isPlaceholderLocation(BigDecimal lat, BigDecimal lon) {
        if (lat == null || lon == null) return false;
        List<double[]> list = placeholders;
        if (list == null) {
            list = new ArrayList<>();
            String spec = placeholderLocations == null ? "" : placeholderLocations;
            for (String part : spec.split(";")) {
                String[] xy = part.trim().split(",");
                if (xy.length != 2) continue;
                try {
                    list.add(new double[]{Double.parseDouble(xy[0].trim()), Double.parseDouble(xy[1].trim())});
                } catch (NumberFormatException ignored) {
                    // skip a malformed entry
                }
            }
            placeholders = list;
        }
        double la = lat.doubleValue();
        double lo = lon.doubleValue();
        for (double[] p : list) {
            if (Math.abs(p[0] - la) < 0.00005 && Math.abs(p[1] - lo) < 0.00005) return true;
        }
        return false;
    }

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
                if (page == 1 && parsed.items.get(0).getRaw() != null) {
                    java.util.List<String> keys = new java.util.ArrayList<>();
                    parsed.items.get(0).getRaw().fieldNames().forEachRemaining(keys::add);
                    log.info("LORIOT gateway fields: {}", keys);
                }
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

    /**
     * Maps one LORIOT gateway object. LORIOT versions differ in field names (title vs name, EUI vs gweui, MAC vs mac,
     * location as a nested object, connected/online/status, lastSeen as epoch or ISO), so every known variant is read.
     */
    private LoriotGateway mapToLoriotGateway(JsonNode node) {
        LoriotGateway g = new LoriotGateway();
        g.setRaw(node);
        g.setId(textOr(node, "_id", "id", "gweui", "EUI", "eui"));
        g.setName(textOr(node, "title", "name", "label"));
        g.setGweui(textOr(node, "EUI", "gweui", "eui", "gwEui", "gatewayEui"));
        g.setMac(textOr(node, "MAC", "mac", "macAddress"));
        g.setSerial(textOr(node, "serial", "serialNumber", "sn"));
        g.setModel(textOr(node, "model", "hwModel", "hw", "base"));
        g.setManufacturer(textOr(node, "manufacturer", "vendor", "brand", "base"));
        g.setFw(textOr(node, "fw", "firmware"));
        g.setFwVersion(textOr(node, "version", "fwVersion", "firmwareVersion", "pfVersion"));
        g.setPacketForwarderVersion(textOr(node, "pf", "packetForwarder", "pfVersion"));
        g.setImei(textOr(node, "imei"));
        g.setNetworkId(textOr(node, "network", "networkId", "net"));
        Boolean explicitOnline = boolOrNull(node, "online", "isOnline", "connected", "alive", "isConnected");
        g.setOnline(explicitOnline);
        g.setStatus(textOr(node, "status", "state", "connection", "connectionStatus"));
        // LORIOT: lastPong = last keep-alive from the gateway (epoch ms), lastData = last packet. Take the newest of all
        // "last heard" style fields; never config timestamps such as updatedAt / createdAt.
        g.setLastSeen(latestInstant(node, "lastPong", "lastData", "lastConnect", "lastSeen", "last_seen", "lastSeenAt", "lastAlive",
                "lastPing", "lastStat", "lastStatus", "lastUplink", "lastActivity", "lastConnected", "lastHeartbeat", "lastRx",
                "lastRxTime", "lastPacket", "lastPacketTime", "lastSeenTime"));
        JsonNode loc = node.path("location");
        if (!loc.isObject()) loc = node.path("gps");
        if (!loc.isObject()) loc = node.path("position");
        JsonNode locNode = loc.isObject() ? loc : node;
        // gwlat / gwlon = the position the gateway itself reports (GPS or its configured fixed position); LORIOT only
        // fills these for gateways that send it (e.g. Milesight gateways on LORIOT's own Milesight connector).
        // lat / lon = the location typed into LORIOT when the gateway was registered (a default point if never set).
        BigDecimal gwLat = nonZero(decimalOr(locNode, "gwlat", "gpsLat", "gps_lat"));
        BigDecimal gwLon = nonZero(decimalOr(locNode, "gwlon", "gpsLon", "gps_lon", "gwlng"));
        boolean gatewayReported = gwLat != null && gwLon != null && gwLat.abs().compareTo(BigDecimal.valueOf(90)) <= 0
                && gwLon.abs().compareTo(BigDecimal.valueOf(180)) <= 0 && !isPlaceholderLocation(gwLat, gwLon);
        g.setLocationReportedByGateway(gatewayReported);
        g.setLatitude(gatewayReported ? gwLat : nonZero(decimalOr(locNode, "lat", "latitude", "y")));
        g.setLongitude(gatewayReported ? gwLon : nonZero(decimalOr(locNode, "lon", "lng", "longitude", "x")));
        g.setAltitude(decimalOr(locNode, "alt", "altitude"));
        BigDecimal lat = g.getLatitude();
        BigDecimal lon = g.getLongitude();
        boolean outOfRange = (lat != null && lat.abs().compareTo(BigDecimal.valueOf(90)) > 0)
                || (lon != null && lon.abs().compareTo(BigDecimal.valueOf(180)) > 0);
        if (outOfRange || isPlaceholderLocation(lat, lon)) {
            g.setLatitude(null);
            g.setLongitude(null);
            g.setAltitude(null);
            g.setLocationPlaceholder(true);
        }
        String address = loc.isObject()
                ? joinNonBlank(textOr(loc, "address", "street"), textOr(loc, "city"), textOr(loc, "country"))
                : textOr(node, "address", "addr");
        if (address == null && !loc.isObject()) address = textOr(node, "location");
        g.setAddress(address);
        return g;
    }

    /** First few gateways exactly as LORIOT returns them (for checking field names). */
    public List<JsonNode> sampleRawGateways(int limit) {
        String path = properties.getPaths().getGateways();
        String sep = path.contains("?") ? "&" : "?";
        String body = authenticatedGet(buildUrl(path) + sep + "perPage=" + Math.max(1, limit) + "&page=1");
        List<JsonNode> out = new ArrayList<>();
        try {
            JsonNode root = objectMapper.readTree(body);
            JsonNode items = root.isArray() ? root : (root.has("gateways") ? root.path("gateways") : (root.has("data") ? root.path("data") : root.path("items")));
            if (items.isArray()) for (JsonNode n : items) { if (out.size() < limit) out.add(n); }
            if (out.isEmpty()) out.add(root);
        } catch (Exception e) {
            out.add(objectMapper.getNodeFactory().textNode(body.length() > 600 ? body.substring(0, 600) + "..." : body));
        }
        return out;
    }

    private static BigDecimal nonZero(BigDecimal v) {
        return v == null || v.signum() == 0 ? null : v;
    }

    private static String joinNonBlank(String... parts) {
        StringBuilder sb = new StringBuilder();
        for (String p : parts) {
            if (p == null || p.isBlank()) continue;
            if (sb.length() > 0) sb.append(", ");
            sb.append(p.trim());
        }
        return sb.length() == 0 ? null : sb.toString();
    }

    /** Epoch seconds, epoch millis or an ISO date-time. */
    /** The newest of several timestamp fields (each may be epoch s / ms or ISO). */
    private Instant latestInstant(JsonNode node, String... keys) {
        Instant best = null;
        Instant ceiling = Instant.now().plusSeconds(300);
        Instant floor = Instant.parse("2015-01-01T00:00:00Z"); // LORIOT uses 1970-01-01 for "never"
        for (String k : keys) {
            Instant v = instantOr(node, k);
            if (v != null && v.isAfter(floor) && !v.isAfter(ceiling) && (best == null || v.isAfter(best))) best = v;
        }
        return best;
    }

    /**
     * Latest GPS fix the gateway itself sent to LORIOT (LORIOT's "GPS" tab: /1/nwk/gateway/{id}/gps), or null.
     * Returns {lat, lon, alt}; alt may be null. Never throws.
     */
    public BigDecimal[] latestGpsFix(String gatewayId) {
        if (gatewayId == null || gatewayId.isBlank()) return null;
        try {
            String id = gatewayId.replace("-", "").replace(":", "").trim().toUpperCase(Locale.ROOT);
            String body = authenticatedGet(buildUrl("/1/nwk/gateway/" + id + "/gps?sort=-date&page=1&perPage=1"));
            if (body == null || body.isBlank()) return null;
            JsonNode root = objectMapper.readTree(body);
            JsonNode list = root.isArray() ? root : root.path("gps");
            if (!list.isArray() || list.isEmpty()) return null;
            JsonNode fix = list.get(0);
            BigDecimal lat = nonZero(decimalOr(fix, "lat", "latitude"));
            BigDecimal lon = nonZero(decimalOr(fix, "lon", "lng", "longitude"));
            if (lat == null || lon == null || lat.abs().compareTo(BigDecimal.valueOf(90)) > 0
                    || lon.abs().compareTo(BigDecimal.valueOf(180)) > 0 || isPlaceholderLocation(lat, lon)) return null;
            return new BigDecimal[]{lat, lon, decimalOr(fix, "alt", "altitude")};
        } catch (Exception e) {
            log.debug("LORIOT GPS lookup failed for {}: {}", gatewayId, e.getMessage());
            return null;
        }
    }

    /** One line per LORIOT gateway: where its location comes from and when it was last heard (admin troubleshooting). */
    public List<java.util.Map<String, Object>> locationAudit() {
        List<java.util.Map<String, Object>> out = new ArrayList<>();
        for (LoriotGateway g : fetchGateways()) {
            JsonNode raw = g.getRaw();
            JsonNode loc = raw == null ? null : raw.path("location");
            java.util.Map<String, Object> m = new java.util.LinkedHashMap<>();
            m.put("title", g.getName());
            m.put("eui", g.getGweui());
            m.put("connector", raw == null ? null : textOr(raw, "basename", "base"));
            m.put("model", raw == null ? null : textOr(raw, "modelname", "model"));
            m.put("version", raw == null ? null : textOr(raw, "version"));
            m.put("connected", g.getOnline());
            m.put("registeredLat", loc == null ? null : decimalOr(loc, "lat"));
            m.put("registeredLon", loc == null ? null : decimalOr(loc, "lon"));
            m.put("gatewayLat", loc == null ? null : decimalOr(loc, "gwlat"));
            m.put("gatewayLon", loc == null ? null : decimalOr(loc, "gwlon"));
            m.put("locationReportedByGateway", g.isLocationReportedByGateway());
            m.put("placeholder", g.isLocationPlaceholder());
            m.put("lastSeen", g.getLastSeen());
            m.put("createdAt", raw == null ? null : textOr(raw, "createdAt"));
            out.add(m);
        }
        return out;
    }

    private Instant instantOr(JsonNode node, String... keys) {
        for (String k : keys) {
            JsonNode n = node.path(k);
            if (n == null || n.isMissingNode() || n.isNull()) continue;
            try {
                if (n.isNumber()) {
                    long v = n.asLong();
                    if (v <= 0) continue;
                    return v < 100_000_000_000L ? Instant.ofEpochSecond(v) : Instant.ofEpochMilli(v);
                }
                String s = n.asText().trim();
                if (s.isEmpty()) continue;
                if (s.matches("\\d+")) {
                    long v = Long.parseLong(s);
                    return v < 100_000_000_000L ? Instant.ofEpochSecond(v) : Instant.ofEpochMilli(v);
                }
                return java.time.OffsetDateTime.parse(s).toInstant();
            } catch (Exception ignored) {
                try {
                    return Instant.parse(n.asText().trim());
                } catch (Exception ignored2) {
                    // not a date
                }
            }
        }
        return null;
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
            String body = response.getBody() == null ? "" : response.getBody();
            String contentType = response.getHeaders().getFirst(HttpHeaders.CONTENT_TYPE);
            boolean looksJson = (contentType != null && contentType.toLowerCase(Locale.ROOT).contains("json"))
                    || (body.startsWith("{") || body.startsWith("["));
            if (!looksJson) {
                log.warn("LORIOT REST HTTP {} to {} returned non-JSON Content-Type={}; first 200 chars: {}",
                        response.getStatusCodeValue(),
                        redactUrl(url),
                        contentType == null ? "none" : contentType,
                        body.length() <= 200 ? body : body.substring(0, 200) + "...");
            } else if (body.isBlank()) {
                log.warn("LORIOT REST HTTP {} to {} returned empty JSON body; check auth token / permissions",
                        response.getStatusCodeValue(), redactUrl(url));
            }
            return body;
        } catch (HttpClientErrorException e) {
            log.warn("LORIOT REST HTTP {} to {}: response body = {}",
                    e.getStatusCode().value(),
                    redactUrl(url),
                    e.getResponseBodyAsString().length() <= 400
                            ? e.getResponseBodyAsString()
                            : e.getResponseBodyAsString().substring(0, 400) + "...");
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
        String override = properties.getRestAuthorization();
        if (override != null && !override.isBlank()) {
            return override.trim();
        }
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
