package com.safalifter.transformerservice.repository;

import com.safalifter.transformerservice.entities.SimCard;
import com.safalifter.transformerservice.enums.SimCardStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface SimCardRepository extends JpaRepository<SimCard, Long> {

    Optional<SimCard> findByNormalizedIccid(String normalizedIccid);

    Optional<SimCard> findByNormalizedImsi(String normalizedImsi);

    Optional<SimCard> findByMsisdn(String msisdn);

    @Query("SELECT s FROM SimCard s WHERE " +
            "(:status IS NULL OR s.status = :status) AND " +
            "(:operator IS NULL OR :operator = '' OR LOWER(s.operator) LIKE LOWER(CONCAT('%', :operator, '%'))) AND " +
            "(:search IS NULL OR :search = '' OR " +
            "LOWER(s.msisdn) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(s.iccid) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(s.normalizedIccid) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(s.imsi) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(s.normalizedImsi) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<SimCard> findWithFilters(
            @Param("status") SimCardStatus status,
            @Param("operator") String operator,
            @Param("search") String search,
            Pageable pageable
    );
}
