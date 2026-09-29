package com.safalifter.transformerservice.repository;

import com.safalifter.transformerservice.entities.GatewaySyncRun;
import com.safalifter.transformerservice.enums.GatewaySyncRunStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GatewaySyncRunRepository extends JpaRepository<GatewaySyncRun, Long> {

    List<GatewaySyncRun> findTop5ByOrderByStartedAtDesc();

    Page<GatewaySyncRun> findAllByOrderByStartedAtDesc(Pageable pageable);

    Optional<GatewaySyncRun> findTopByStatusNotOrderByStartedAtDesc(GatewaySyncRunStatus status);
}
