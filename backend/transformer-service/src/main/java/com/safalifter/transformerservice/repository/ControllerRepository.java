package com.safalifter.transformerservice.repository;

import com.safalifter.transformerservice.entities.Controller;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ControllerRepository extends JpaRepository<Controller, Long> {
    List<Controller> findByTransformerId(Long transformerId);
    Optional<Controller> findByTransformerIdAndDeviceId(Long transformerId, String deviceId);
    Optional<Controller> findByDeviceId(String deviceId);
    Optional<Controller> findByDeviceIdIgnoreCase(String deviceId);
    List<Controller> findAllByDeviceIdIgnoreCase(String deviceId);
    Optional<Controller> findByDevEui(String devEui);
    Optional<Controller> findByDevEuiIgnoreCase(String devEui);
    List<Controller> findAllByDevEuiIgnoreCase(String devEui);
    List<Controller> findAllBySupplierCode(String supplierCode);
    Optional<Controller> findByIdAndSupplierCode(Long id, String supplierCode);
    List<Controller> findByTransformerIdAndSupplierCode(Long transformerId, String supplierCode);
    Optional<Controller> findByDevEuiAndSupplierCode(String devEui, String supplierCode);
}
