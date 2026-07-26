package com.safalifter.notificationservice.payload.chat;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatCommandSearchBridgeRequest {
    private String sender;
    private String action;
    private String query;
    private String source;
}
