package com.safalifter.authservice.service;

import com.safalifter.authservice.payload.response.ChatCommandUserResponse;

public interface ChatCommandAccessService {
    ChatCommandUserResponse resolveUserByContact(String contact);
}
