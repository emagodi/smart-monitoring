package com.safalifter.notificationservice.payload;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WhatsAppEligibilityResponse {
    private String waId;
    private String phoneNumber;
    private Boolean optedIn;
    private LocalDateTime optInAt;
    private String optInSource;
    private Boolean freeFormEligible;
    private LocalDateTime conversationWindowOpenUntil;
    private String lastInboundMessageType;
    private String lastInboundMessageBody;
    private LocalDateTime lastInboundMessageAt;
    private String lastOutboundMode;
    private String lastTemplateName;
    private LocalDateTime lastOutboundAcceptedAt;
    private String lastStatus;
    private LocalDateTime lastStatusAt;
    private String lastDecisionReason;
    private String lastConversationId;
}
