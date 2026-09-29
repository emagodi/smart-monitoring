package com.safalifter.transformerservice.repository;

import com.safalifter.transformerservice.entities.GatewaySimAssignment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface GatewaySimAssignmentRepository extends JpaRepository<GatewaySimAssignment, Long> {

    List<GatewaySimAssignment> findByGatewayIdOrderByAssignedAtDesc(Long gatewayId);

    Page<GatewaySimAssignment> findByGatewayIdOrderByAssignedAtDesc(Long gatewayId, Pageable pageable);

    @Query("SELECT a FROM GatewaySimAssignment a WHERE a.gatewayId = :gatewayId AND a.active = true")
    Optional<GatewaySimAssignment> findActiveByGatewayId(@Param("gatewayId") Long gatewayId);

    @Query("SELECT a FROM GatewaySimAssignment a WHERE a.simId = :simId AND a.active = true")
    Optional<GatewaySimAssignment> findActiveBySimId(@Param("simId") Long simId);

    @Query("SELECT COUNT(a) FROM GatewaySimAssignment a WHERE a.simId = :simId AND a.active = true")
    Long countActiveBySimId(@Param("simId") Long simId);

    List<GatewaySimAssignment> findBySimIdOrderByAssignedAtDesc(Long simId);
}
