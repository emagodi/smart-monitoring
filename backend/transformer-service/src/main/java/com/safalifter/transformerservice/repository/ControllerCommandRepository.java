package com.safalifter.transformerservice.repository;

import com.safalifter.transformerservice.entities.ControllerCommand;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.Set;

public interface ControllerCommandRepository extends JpaRepository<ControllerCommand, Long> {
    Optional<ControllerCommand> findTopByTransformerIdOrderByCreatedAtDesc(Long transformerId);

    List<ControllerCommand> findTop5000ByTransformerIdInOrderByCreatedAtDesc(Set<Long> transformerIds);
}
