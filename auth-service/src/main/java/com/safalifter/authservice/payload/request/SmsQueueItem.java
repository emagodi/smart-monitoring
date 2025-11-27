package com.safalifter.authservice.payload.request;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class SmsQueueItem {
    private String phone;
    private String message;
}
