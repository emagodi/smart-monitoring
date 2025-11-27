package com.safalifter.authservice.payload.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.safalifter.authservice.enums.Region;
import com.safalifter.authservice.enums.District;
import com.safalifter.authservice.enums.Depot;
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

    private Region region;

    private District district;

    private Depot depot;

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
