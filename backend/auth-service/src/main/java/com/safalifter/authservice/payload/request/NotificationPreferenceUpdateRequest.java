package com.safalifter.authservice.payload.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationPreferenceUpdateRequest {
    private List<NotificationPreferenceUpdateItem> preferences;
}
