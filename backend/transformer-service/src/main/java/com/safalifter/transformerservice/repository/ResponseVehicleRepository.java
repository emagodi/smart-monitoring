package com.safalifter.transformerservice.repository;

import com.safalifter.transformerservice.entities.ResponseVehicle;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ResponseVehicleRepository extends JpaRepository<ResponseVehicle, Long> {
    List<ResponseVehicle> findAllByActiveTrueOrderByDepotNameAscRegistrationAsc();
    List<ResponseVehicle> findAllByActiveTrueAndDepotIdOrderByRegistrationAsc(Long depotId);
    boolean existsByRegistrationIgnoreCaseAndActiveTrue(String registration);
}
