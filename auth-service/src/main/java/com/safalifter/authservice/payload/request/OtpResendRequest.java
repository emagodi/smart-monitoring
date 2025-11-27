package com.safalifter.authservice.payload.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Builder
@NoArgsConstructor
@AllArgsConstructor
@Data
public class OtpResendRequest {

    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    private String email;

}
