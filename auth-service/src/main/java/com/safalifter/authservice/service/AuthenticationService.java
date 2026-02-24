package com.safalifter.authservice.service;

import com.safalifter.authservice.entities.User;
import com.safalifter.authservice.payload.request.AuthenticationRequest;
import com.safalifter.authservice.payload.request.RegisterRequest;
import com.safalifter.authservice.payload.request.UserUpdateRequest;
import com.safalifter.authservice.payload.response.AuthenticationResponse;


public interface AuthenticationService {

    public AuthenticationResponse register(RegisterRequest request);
    AuthenticationResponse authenticate(AuthenticationRequest request);

    public User getUserById(Long id);

    public User updateUser(Long userId, UserUpdateRequest userUpdateRequest);

    public void changePassword(String email, String currentPassword, String newPassword);

    public String generateOtp();
}
