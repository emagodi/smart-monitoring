package com.safalifter.transformerservice.repository;

import com.safalifter.transformerservice.entities.CameraImage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CameraImageRepository extends JpaRepository<CameraImage, Long> {
    List<CameraImage> findTop5ByCameraIdOrderByCapturedAtDesc(Long cameraId);
}
