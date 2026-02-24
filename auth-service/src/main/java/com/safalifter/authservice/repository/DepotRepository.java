package com.safalifter.authservice.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.safalifter.authservice.entities.Depot;

import java.util.List;
import java.util.Optional;

public interface DepotRepository extends JpaRepository<Depot, Long> {
    List<Depot> findByDistrictId(Long districtId);
    Optional<Depot> findByDistrictIdAndName(Long districtId, String name);
}