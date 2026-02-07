
package com.safalifter.transformerservice.client;

import com.safalifter.transformerservice.payload.response.VisionAnalysisResponse;
import com.safalifter.transformerservice.payload.request.SensorAnalysisRequest;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(name = "vision-ai-service", url = "${VISION_AI_URL:http://vision-ai-service:8000}")
public interface VisionClient {

    @PostMapping("/analyze/sensor")
    VisionAnalysisResponse analyzeSensor(@RequestBody SensorAnalysisRequest request);
}
