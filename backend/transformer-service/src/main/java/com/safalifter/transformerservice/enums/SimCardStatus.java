package com.safalifter.transformerservice.enums;

/**
 * Where the SIM is: AVAILABLE (spare stock), ASSIGNED (in a gateway) or RETIRED (out of the inventory).
 * The other values are legacy single-status values from before the split; the schema upgrade moves them into
 * {@link SimNetworkState} / {@link SimCondition} and they are no longer written.
 */
public enum SimCardStatus {
    AVAILABLE,
    ASSIGNED,
    ACTIVE,
    SUSPENDED,
    LOST,
    DAMAGED,
    EXPIRED,
    DECOMMISSIONED,
    RETIRED
}
