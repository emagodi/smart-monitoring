package com.safalifter.transformerservice.payload.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatCommandSearchRequest {
    private String sender;
    private String action;
    private String query;
    private String source;
}
