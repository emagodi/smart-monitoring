package com.safalifter.transformerservice.integration.loriot;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.Data;
import lombok.ToString;

import java.math.BigDecimal;
import java.time.Instant;

@Data
@ToString
public class LoriotGateway {
    private String id;
    private String name;
    private String gweui;
    private String mac;
    private String serial;
    private String model;
    private String manufacturer;
    private String fw;
    private String fwVersion;
    private String packetForwarderVersion;
    private String imei;
    private String networkId;
    private Boolean online;
    private String status;
    private Instant lastSeen;
    private BigDecimal latitude;
    private BigDecimal longitude;
    private BigDecimal altitude;
    private String address;
    private JsonNode raw;

    public boolean isOnlineValue() {
        if (online != null) {
            return online;
        }
        if (status != null) {
            String s = status.toLowerCase().trim();
            return s.equals("online") || s.equals("connected") || s.equals("up");
        }
        return false;
    }
}
