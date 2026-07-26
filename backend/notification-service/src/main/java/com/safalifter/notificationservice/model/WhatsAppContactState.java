package com.safalifter.notificationservice.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.Lob;
import java.time.LocalDateTime;

@Entity(name = "whatsapp_contact_state")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WhatsAppContactState {

    @Id
    private String waId;

    private String phoneNumber;
    private String lastInboundMessageId;
    private String lastInboundMessageType;

    @Lob
    private String lastInboundMessageBody;

    private LocalDateTime lastInboundMessageAt;
    private LocalDateTime conversationWindowOpenUntil;
    private Boolean freeFormEligible;
    private Boolean optedIn;
    private LocalDateTime optInAt;
    private String optInSource;
    private String lastConversationId;
    private String lastStatus;
    private LocalDateTime lastStatusAt;
    private LocalDateTime lastOutboundAcceptedAt;
    private String lastOutboundMode;
    private String lastTemplateName;
    private String lastDecisionReason;
    private String commandSessionState;
    private String pendingCommandAction;
    private String pendingSearchQuery;

    @Lob
    private String pendingSearchOptions;

    private Long pendingTransformerId;
    private String pendingTransformerName;
    private LocalDateTime commandSessionUpdatedAt;

    @CreationTimestamp
    private LocalDateTime creationTimestamp;

    @UpdateTimestamp
    private LocalDateTime updateTimestamp;
}
