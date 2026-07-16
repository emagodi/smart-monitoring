package com.safalifter.transformerservice.repository;

import com.safalifter.transformerservice.entities.Transformer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TransformerRepository extends JpaRepository<Transformer, Long> {
    List<Transformer> findByDepotId(Long depotId);
    Optional<Transformer> findByDepotIdAndName(Long depotId, String name);
    List<Transformer> findAllBySupplierCode(String supplierCode);
    Optional<Transformer> findByIdAndSupplierCode(Long id, String supplierCode);
    List<Transformer> findByDepotIdAndSupplierCode(Long depotId, String supplierCode);
    Optional<Transformer> findBySupplierCodeAndName(String supplierCode, String name);
}
