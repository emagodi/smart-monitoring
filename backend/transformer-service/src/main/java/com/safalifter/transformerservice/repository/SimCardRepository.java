package com.safalifter.transformerservice.repository;

import com.safalifter.transformerservice.entities.SimCard;
import com.safalifter.transformerservice.enums.SimCardStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface SimCardRepository extends JpaRepository<SimCard, Long> {

    Optional<SimCard> findByNormalizedIccid(String normalizedIccid);

    Optional<SimCard> findByNormalizedImsi(String normalizedImsi);

    Optional<SimCard> findByMsisdn(String msisdn);

    @Query("SELECT s FROM SimCard s WHERE s.status = 'AVAILABLE' AND s.id NOT IN " +
            "(SELECT a.simId FROM GatewaySimAssignment a WHERE a.active = true)")
    Page<SimCard> findAvailable(Pageable pageable);

    @Query("SELECT s FROM SimCard s WHERE " +
            "(:status IS NULL OR s.status = :status) AND " +
            "(:operator IS NULL OR :operator = '' OR LOWER(s.operator) LIKE LOWER(CONCAT('%', :operator, '%'))) AND " +
            "(:hasPin IS NULL OR (:hasPin = true AND s.encryptedPin IS NOT NULL AND s.encryptedPin <> '') " +
            "   OR (:hasPin = false AND (s.encryptedPin IS NULL OR s.encryptedPin = ''))) AND " +
            "(:hasPuk IS NULL OR (:hasPuk = true AND s.encryptedPuk IS NOT NULL AND s.encryptedPuk <> '') " +
            "   OR (:hasPuk = false AND (s.encryptedPuk IS NULL OR s.encryptedPuk = ''))) AND " +
            "(:assigned IS NULL " +
            "   OR (:assigned = true AND s.id IN (SELECT a.simId FROM GatewaySimAssignment a WHERE a.active = true)) " +
            "   OR (:assigned = false AND s.id NOT IN (SELECT a.simId FROM GatewaySimAssignment a WHERE a.active = true))) AND " +
            "(:search IS NULL OR :search = '' OR " +
            "LOWER(s.msisdn) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(s.iccid) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(s.normalizedIccid) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(s.imsi) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(s.normalizedImsi) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(s.operator) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "s.id IN (SELECT a.simId FROM GatewaySimAssignment a, Gateway g WHERE a.active = true AND g.id = a.gatewayId " +
            "         AND LOWER(g.name) LIKE LOWER(CONCAT('%', :search, '%'))))")
    Page<SimCard> findWithFilters(
            @Param("status") SimCardStatus status,
            @Param("operator") String operator,
            @Param("hasPin") Boolean hasPin,
            @Param("hasPuk") Boolean hasPuk,
            @Param("assigned") Boolean assigned,
            @Param("search") String search,
            Pageable pageable
    );

    // ----------------------------------------------------------------- inventory summary (hero tiles + filter counts)

    @Query("SELECT s.status, COUNT(s) FROM SimCard s GROUP BY s.status")
    List<Object[]> countByStatus();

    @Query("SELECT COUNT(s) FROM SimCard s WHERE s.encryptedPin IS NOT NULL AND s.encryptedPin <> ''")
    long countWithPin();

    @Query("SELECT COUNT(s) FROM SimCard s WHERE s.encryptedPuk IS NOT NULL AND s.encryptedPuk <> ''")
    long countWithPuk();

    @Query("SELECT COUNT(DISTINCT a.simId) FROM GatewaySimAssignment a WHERE a.active = true")
    long countInGateway();

    @Query("SELECT DISTINCT s.operator FROM SimCard s WHERE s.operator IS NOT NULL AND s.operator <> '' ORDER BY s.operator")
    List<String> distinctOperators();
}
