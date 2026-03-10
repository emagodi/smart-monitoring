package com.safalifter.authservice.payload.request;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class SmsRequest {
    private List<String> to;   // must be "to" exactly
    private String message;
}
