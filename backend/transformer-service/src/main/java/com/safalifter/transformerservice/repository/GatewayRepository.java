package com.safalifter.transformerservice.repository;

import com.safalifter.transformerservice.entities.Gateway;
import com.safalifter.transformerservice.enums.GatewayStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface GatewayRepository extends JpaRepository<Gateway, Long> {

    Optional<Gateway> findByLoriotGatewayId(String loriotGatewayId);

    Optional<Gateway> findByNormalizedGatewayEui(String normalizedGatewayEui);

    Optional<Gateway> findByNormalizedMac(String normalizedMac);

    Page<Gateway> findByEffectiveStatus(GatewayStatus effectiveStatus, Pageable pageable);

    @Query("SELECT g FROM Gateway g WHERE g.effectiveStatus = :status AND g.latitude IS NOT NULL AND g.longitude IS NOT NULL")
    List<Gateway> findMapPointsWithStatus(@Param("status") GatewayStatus status);

    @Query("SELECT g FROM Gateway g WHERE g.latitude IS NOT NULL AND g.longitude IS NOT NULL")
    List<Gateway> findAllMapPoints();

    @Query("SELECT g.effectiveStatus, COUNT(g) FROM Gateway g GROUP BY g.effectiveStatus")
    List<Object[]> countByEffectiveStatus();

    @Query("SELECT COUNT(g) FROM Gateway g WHERE g.latitude IS NULL OR g.longitude IS NULL")
    Long countMissingLocation();

    @Query("SELECT COUNT(g) FROM Gateway g WHERE g.id NOT IN (SELECT a.gatewayId FROM GatewaySimAssignment a WHERE a.active = true)")
    Long countMissingSim();

    @Query("SELECT g FROM Gateway g WHERE " +
            "(:search IS NULL OR :search = '' OR " +
            "LOWER(g.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(g.gatewayEui) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(g.normalizedGatewayEui) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(g.macAddress) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(g.normalizedMac) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(g.serialNumber) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<Gateway> search(@Param("search") String search, Pageable pageable);

    @Query("SELECT g FROM Gateway g WHERE " +
            "(:status IS NULL OR g.effectiveStatus = :status) AND " +
            "(:regionId IS NULL OR g.regionId = :regionId) AND " +
            "(:districtId IS NULL OR g.districtId = :districtId) AND " +
            "(:depotId IS NULL OR g.depotId = :depotId) AND " +
            "(:networkId IS NULL OR :networkId = '' OR g.networkId = :networkId) AND " +
            "(:model IS NULL OR :model = '' OR LOWER(g.model) LIKE LOWER(CONCAT('%', :model, '%'))) AND " +
            "(:search IS NULL OR :search = '' OR " +
            "LOWER(g.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(g.gatewayEui) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(g.normalizedGatewayEui) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(g.macAddress) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(g.serialNumber) LIKE LOWER(CONCAT('%', :search, '%'))) AND " +
            "(:lastSeenFrom IS NULL OR g.lastTrafficSeenAt >= :lastSeenFrom OR g.lastLoriotSeenAt >= :lastSeenFrom) AND " +
            "(:lastSeenTo IS NULL OR g.lastTrafficSeenAt <= :lastSeenTo OR g.lastLoriotSeenAt <= :lastSeenTo)")
    Page<Gateway> findWithFilters(
            @Param("status") GatewayStatus status,
            @Param("regionId") Long regionId,
            @Param("districtId") Long districtId,
            @Param("depotId") Long depotId,
            @Param("networkId") String networkId,
            @Param("model") String model,
            @Param("search") String search,
            @Param("lastSeenFrom") Instant lastSeenFrom,
            @Param("lastSeenTo") Instant lastSeenTo,
            Pageable pageable
    );
}
