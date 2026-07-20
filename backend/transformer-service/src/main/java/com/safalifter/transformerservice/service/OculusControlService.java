package com.safalifter.transformerservice.service;

import com.safalifter.transformerservice.payload.response.OculusControlActionResponse;
import com.safalifter.transformerservice.payload.response.OculusTransformerControlResponse;

import java.util.List;

public interface OculusControlService {
    List<OculusTransformerControlResponse> listTransformers();
    OculusControlActionResponse armTransformer(Long transformerId);
    OculusControlActionResponse disarmTransformer(Long transformerId);
}
