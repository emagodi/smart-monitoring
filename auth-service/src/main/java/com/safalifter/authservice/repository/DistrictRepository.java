package com.safalifter.authservice.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.safalifter.authservice.entities.District;

import java.util.List;
import java.util.Optional;

public interface DistrictRepository extends JpaRepository<District, Long> {
    List<District> findByRegionId(Long regionId);
    Optional<District> findByRegionIdAndName(Long regionId, String name);
}