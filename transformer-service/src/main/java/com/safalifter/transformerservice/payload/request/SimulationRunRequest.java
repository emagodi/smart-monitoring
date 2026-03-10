package com.safalifter.transformerservice.payload.request;

import lombok.Data;
import org.springframework.web.multipart.MultipartFile;

@Data
public class SimulationRunRequest {
    private Long transformerId;
    private Long cameraId;
    private Boolean di1;
    private Boolean di2;
    private MultipartFile image;
}
