package com.safalifter.notificationservice.payload.chat;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatCommandTransformerOption {
    private Long transformerId;
    private String transformerName;
    private Long depotId;
    private String supplierCode;
    private String supplierName;
    private boolean controllable;
    private String controllerName;
    private String controllerDevEui;
}
