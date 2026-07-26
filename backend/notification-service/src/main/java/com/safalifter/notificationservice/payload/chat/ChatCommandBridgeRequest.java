package com.safalifter.notificationservice.payload.chat;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatCommandBridgeRequest {
    private String sender;
    private Long transformerId;
    private String action;
    private String source;
    private String commandText;
}
