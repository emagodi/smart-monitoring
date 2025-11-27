package com.safalifter.authservice.payload.response;

import lombok.*;

import java.time.LocalDateTime;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class SignatureResponse {
    private Long id;
    private String fileName;
    private String filePath;
    private String fileType;
    private String version;
    private Long userId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

