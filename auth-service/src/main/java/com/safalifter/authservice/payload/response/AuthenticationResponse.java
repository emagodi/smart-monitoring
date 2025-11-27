package com.safalifter.authservice.payload.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthenticationResponse {
    private  Long id;

    private String firstname;

    private String lastname;

    private String password;


    private String email;

    private String phone;

    private List<String> roles;

    private boolean temporaryPassword;

    @JsonProperty("access_token")
    private String accessToken;
    @JsonProperty("refresh_token")
    private String refreshToken;
    @JsonProperty("token_type")
    private String tokenType;

    private String message;

    private boolean createdByAdmin;

}
