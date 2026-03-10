package com.safalifter.authservice.payload.request;


import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChangePasswordRequest {
    @NotBlank(message = "New password cannot be blank")
    private String newPassword;

    // Optionally, you can add old password if necessary
    @NotBlank(message = "Old password cannot be blank")
    private String oldPassword;

}