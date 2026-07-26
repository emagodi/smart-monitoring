package com.safalifter.notificationservice.payload.chat;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatCommandSearchBridgeResponse {
    private String status;
    private String action;
    private String operatorName;
    private String message;
    private List<ChatCommandTransformerOption> options;
}
