package com.safalifter.authservice.payload.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserTypeResponse {
    private Long id;
    private String name;
    private String description;
    private String status;
    private long userCount;
}
