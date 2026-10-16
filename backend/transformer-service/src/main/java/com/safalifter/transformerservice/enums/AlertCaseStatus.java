package com.safalifter.transformerservice.enums;

/**
 * Incident lifecycle for an alert case.
 *
 * NEW -> ACKNOWLEDGED (contact centre) -> DISPATCHED (vehicle assigned) -> EN_ROUTE (crew accepted)
 *     -> ON_SCENE (crew arrived) -> RESOLVED | FALSE_ALARM (closed, see IncidentOutcome)
 */
public enum AlertCaseStatus {
    NEW,
    ACKNOWLEDGED,
    DISPATCHED,
    EN_ROUTE,
    ON_SCENE,
    RESOLVED,
    FALSE_ALARM;

    public boolean isOpen() {
        return this != RESOLVED && this != FALSE_ALARM;
    }
}
