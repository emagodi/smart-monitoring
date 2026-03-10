package com.safalifter.transformerservice.service;

import com.safalifter.transformerservice.payload.request.CameraEventRequest;
import com.safalifter.transformerservice.payload.request.CameraRequest;
import com.safalifter.transformerservice.payload.response.CameraImageResponse;
import com.safalifter.transformerservice.payload.response.CameraResponse;
import org.springframework.core.io.Resource;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.List;

public interface CameraService {
    CameraResponse register(CameraRequest request);
    void processEvent(CameraEventRequest event);
    List<CameraResponse> getAll();
    List<CameraResponse> getByTransformerId(Long transformerId);
    CameraResponse getById(Long id);
    CameraResponse update(Long id, CameraRequest request);
    void delete(Long id);
    CameraImageResponse saveImage(Long cameraId, MultipartFile file);
    List<CameraImageResponse> getLatestImages(Long cameraId);
    List<CameraImageResponse> getImagesByDateRange(Long cameraId, LocalDateTime start, LocalDateTime end);
    Resource getImage(String filename);
}
