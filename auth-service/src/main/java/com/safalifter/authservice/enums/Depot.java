package com.safalifter.authservice.enums;

public enum Depot {

    WARRENPARK("Warren Park"),
    GLENVIEW("Glenview"),
    MBARE("Mbare");
    
    private final String displayName;

    Depot(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}
