package com.safalifter.transformerservice.repository;

import com.safalifter.transformerservice.entities.AlertCase;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface AlertCaseRepository extends JpaRepository<AlertCase, Long> {
    Optional<AlertCase> findByAlertId(Long alertId);
    List<AlertCase> findAllByAlertIdIn(Collection<Long> alertIds);
}
