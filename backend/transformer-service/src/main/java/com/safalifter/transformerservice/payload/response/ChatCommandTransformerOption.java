package com.safalifter.transformerservice.payload.response;

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
    private Long id;
    private String transformerName;
    private String name;
    private Long depotId;
    private String supplierCode;
    private String supplierName;
    private boolean controllable;
    private String controllerName;
    private String controllerDevEui;
}
