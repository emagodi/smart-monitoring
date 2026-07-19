package com.safalifter.transformerservice.repository;

import com.safalifter.transformerservice.entities.ControllerCommand;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ControllerCommandRepository extends JpaRepository<ControllerCommand, Long> {
    Optional<ControllerCommand> findTopByTransformerIdOrderByCreatedAtDesc(Long transformerId);
}
