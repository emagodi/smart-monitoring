package com.safalifter.transformerservice.payload.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Outcome of AlertService#raise. Ingest code uses {@link #shouldNotify} to decide whether
 * an email/WhatsApp notification goes out, so repeated triggers do not spam technicians.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlertRaiseResult {
    private AlertResponse alert;
    /** true when a brand-new alert row + case was inserted; false when folded into an open alert. */
    private boolean created;
    /** true when the caller should send a notification for this event. */
    private boolean shouldNotify;
}
