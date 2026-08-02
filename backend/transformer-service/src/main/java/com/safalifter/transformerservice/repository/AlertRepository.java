package com.safalifter.transformerservice.repository;

import com.safalifter.transformerservice.entities.Alert;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AlertRepository extends JpaRepository<Alert, Long> {
    List<Alert> findBySensorId(Long sensorId);
    List<Alert> findByCameraId(Long cameraId);
    List<Alert> findAllBySupplierCode(String supplierCode);
    List<Alert> findAllByOrderByCreatedAtDesc();
    List<Alert> findAllBySupplierCodeOrderByCreatedAtDesc(String supplierCode);
    Page<Alert> findAllByOrderByCreatedAtDesc(Pageable pageable);
    Page<Alert> findAllBySupplierCodeOrderByCreatedAtDesc(String supplierCode, Pageable pageable);
    Page<Alert> findAllByDepotIdOrderByCreatedAtDesc(Long depotId, Pageable pageable);
    Page<Alert> findAllBySupplierCodeAndDepotIdOrderByCreatedAtDesc(String supplierCode, Long depotId, Pageable pageable);
    java.util.Optional<Alert> findByIdAndSupplierCode(Long id, String supplierCode);
    List<Alert> findBySensorIdAndSupplierCode(Long sensorId, String supplierCode);
}
