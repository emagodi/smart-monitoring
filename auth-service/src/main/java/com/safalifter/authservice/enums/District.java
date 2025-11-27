package com.safalifter.authservice.enums;

public enum District {
    HARARENORTH("Harare North"),
    HARARESOUTH("Harare South");
    
    private final String displayName;

    District(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}
