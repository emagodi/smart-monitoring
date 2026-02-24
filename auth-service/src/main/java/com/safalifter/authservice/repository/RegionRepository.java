package com.safalifter.authservice.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.safalifter.authservice.entities.Region;

import java.util.Optional;

public interface RegionRepository extends JpaRepository<Region, Long> {
    Optional<Region> findByName(String name);
}