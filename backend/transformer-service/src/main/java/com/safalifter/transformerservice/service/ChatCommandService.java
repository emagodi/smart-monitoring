package com.safalifter.transformerservice.service;

import com.safalifter.transformerservice.payload.request.ChatCommandRequest;
import com.safalifter.transformerservice.payload.response.ChatCommandResponse;

public interface ChatCommandService {
    ChatCommandResponse handleOculusCommand(ChatCommandRequest request);
}
