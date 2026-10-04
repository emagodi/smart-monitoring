package com.safalifter.transformerservice.repository;

import com.safalifter.transformerservice.entities.ControllerCommand;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.Set;

public interface ControllerCommandRepository extends JpaRepository<ControllerCommand, Long> {
    Optional<ControllerCommand> findTopByTransformerIdOrderByCreatedAtDesc(Long transformerId);

    @Query("SELECT c FROM ControllerCommand c WHERE c.transformerId IN :ids AND c.createdAt = " +
           "(SELECT MAX(c2.createdAt) FROM ControllerCommand c2 WHERE c2.transformerId = c.transformerId)")
    List<ControllerCommand> findLatestPerTransformerIdIn(@Param("ids") Set<Long> transformerIds);
}
