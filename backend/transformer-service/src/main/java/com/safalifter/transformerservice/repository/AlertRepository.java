package com.safalifter.transformerservice.repository;

import com.safalifter.transformerservice.entities.Alert;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AlertRepository extends JpaRepository<Alert, Long> {
    List<Alert> findBySensorId(Long sensorId);
    List<Alert> findByCameraId(Long cameraId);
    List<Alert> findAllBySupplierCode(String supplierCode);
    java.util.Optional<Alert> findByIdAndSupplierCode(Long id, String supplierCode);
    List<Alert> findBySensorIdAndSupplierCode(Long sensorId, String supplierCode);
}
