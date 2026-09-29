package com.safalifter.transformerservice.repository;

import com.safalifter.transformerservice.entities.GatewayTransformerCoverage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GatewayTransformerCoverageRepository extends JpaRepository<GatewayTransformerCoverage, Long> {

    List<GatewayTransformerCoverage> findByGatewayId(Long gatewayId);

    List<GatewayTransformerCoverage> findByTransformerId(Long transformerId);

    Optional<GatewayTransformerCoverage> findByGatewayIdAndTransformerId(Long gatewayId, Long transformerId);

    void deleteByGatewayIdAndTransformerId(Long gatewayId, Long transformerId);
}
