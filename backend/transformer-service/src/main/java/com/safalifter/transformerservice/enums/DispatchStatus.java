package com.safalifter.transformerservice.enums;

public enum DispatchStatus {
    /** Vehicle assigned, crew notified, waiting for crew to accept. */
    DISPATCHED,
    /** Crew accepted and is on the way. */
    ACCEPTED,
    /** Crew is at the transformer. */
    ON_SCENE,
    /** Crew finished; outcome recorded on the case. */
    COMPLETED,
    /** Dispatch withdrawn (vehicle recalled or reassigned). */
    CANCELLED;

    public boolean isActive() {
        return this == DISPATCHED || this == ACCEPTED || this == ON_SCENE;
    }
}
