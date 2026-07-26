package com.safalifter.transformerservice.service;

import com.safalifter.transformerservice.payload.request.ChatCommandRequest;
import com.safalifter.transformerservice.payload.request.ChatCommandSearchRequest;
import com.safalifter.transformerservice.payload.response.ChatCommandResponse;
import com.safalifter.transformerservice.payload.response.ChatCommandSearchResponse;

public interface ChatCommandService {
    ChatCommandResponse handleOculusCommand(ChatCommandRequest request);
    ChatCommandSearchResponse searchOculusTransformers(ChatCommandSearchRequest request);
}
