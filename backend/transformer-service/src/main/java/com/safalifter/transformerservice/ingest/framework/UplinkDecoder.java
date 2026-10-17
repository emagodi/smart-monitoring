package com.safalifter.transformerservice.ingest.framework;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * One implementation per device family / supplier payload format. Register as a Spring bean
 * and it becomes selectable for any supplier integration by its {@link #key()}.
 */
public interface UplinkDecoder {

    /** Stable identifier stored on supplier_integrations.decoder_key, e.g. "dragino-lt22222". */
    String key();

    /** Human label shown in the admin screen. */
    String label();

    /**
     * @param payload raw application payload bytes (may be empty when the network server already decoded)
     * @param port    LoRaWAN fPort
     * @param message the full network-server message (LORIOT JSON etc.), for decoders that read pre-decoded fields
     */
    DecodedUplink decode(byte[] payload, int port, JsonNode message);
}
