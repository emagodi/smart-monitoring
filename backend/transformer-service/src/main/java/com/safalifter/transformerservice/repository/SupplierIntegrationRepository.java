package com.safalifter.transformerservice.repository;

import com.safalifter.transformerservice.entities.SupplierIntegration;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SupplierIntegrationRepository extends JpaRepository<SupplierIntegration, Long> {
    List<SupplierIntegration> findAllByOrderBySupplierCodeAscNameAsc();
    List<SupplierIntegration> findAllByEnabledTrueAndTransport(String transport);
}
