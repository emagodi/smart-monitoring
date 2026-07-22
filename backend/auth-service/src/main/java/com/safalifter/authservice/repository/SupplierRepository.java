package com.safalifter.authservice.repository;

import com.safalifter.authservice.entities.SupplierEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SupplierRepository extends JpaRepository<SupplierEntity, Long> {
    Optional<SupplierEntity> findByCode(String code);
    Optional<SupplierEntity> findByCodeIgnoreCase(String code);
    Optional<SupplierEntity> findByName(String name);
}
