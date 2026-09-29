package com.safalifter.transformerservice.integration.loriot;

import lombok.Data;
import lombok.ToString;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "loriot")
public class LoriotProperties {

    private String baseUrl = "https://lorawan.powertel.co.zw";

    private String websocketUrl = "";

    private String applicationAccessToken = "";

    @ToString.Exclude
    private String userApiKey = "";

    private String networkId = "A0000005";

    private Long gatewaySyncIntervalMs = 300000L;

    @ToString.Exclude
    private String notificationSecret = "";

    private String userApiAuthPattern = "Bearer {}";

    private Path paths = new Path();

    private Retry retry = new Retry();

    @Data
    public static class Path {
        private String gateways = "/1/nwk/gateways";
        private String gatewaysFallback = "/api/network/{networkId}/gateways";
        private String gatewayDetail = "/1/nwk/gateway/{gatewayId}";
        private String gatewayEvents = "/1/nwk/gateway/{gatewayId}/events";
    }

    @Data
    public static class Retry {
        private int maxAttempts = 3;
        private long initialDelayMs = 500L;
        private double backoffMultiplier = 2.0;
    }
}
