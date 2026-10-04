package com.safalifter.transformerservice.repository;

import com.safalifter.transformerservice.entities.ControllerCommand;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.Set;

public interface ControllerCommandRepository extends JpaRepository<ControllerCommand, Long> {
    Optional<ControllerCommand> findTopByTransformerIdOrderByCreatedAtDesc(Long transformerId);

    @Query("SELECT c FROM ControllerCommand c WHERE c.transformerId IN :ids ORDER BY c.createdAt DESC")
    List<ControllerCommand> findRecentByTransformerIdInLimit(@Param("ids") Set<Long> transformerIds, Pageable pageable);
}
