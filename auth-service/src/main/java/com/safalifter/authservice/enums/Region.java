package com.safalifter.authservice.enums;

public enum Region {
    HARARE("Harare"),
    SOUTHERN("Southern"),
    NORTHERN("Northern"),  
    EASTERN("Eastern");
    
    private final String displayName;

    Region(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}
