package com.safalifter.transformerservice.enums;

/** What the response team found when closing an incident. */
public enum IncidentOutcome {
    /** Confirmed intrusion, theft or vandalism attempt. */
    REAL_THREAT,
    /** Nothing found: animal, wind, staff on site, sensor noise. */
    FALSE_ALARM,
    /** Equipment problem (faulty sensor/controller/door switch) that needs maintenance. */
    TECHNICAL_FAULT,
    /** Authorised work on site (ZESA/Powertel crew) that was not disarmed beforehand. */
    AUTHORISED_ACTIVITY,
    OTHER
}
