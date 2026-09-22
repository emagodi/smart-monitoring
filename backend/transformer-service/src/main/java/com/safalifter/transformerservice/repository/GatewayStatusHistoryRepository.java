package com.safalifter.transformerservice.repository;

import com.safalifter.transformerservice.entities.GatewayStatusHistory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface GatewayStatusHistoryRepository extends JpaRepository<GatewayStatusHistory, Long> {

    Page<GatewayStatusHistory> findByGatewayIdOrderByObservedAtDesc(Long gatewayId, Pageable pageable);

    List<GatewayStatusHistory> findTop5ByGatewayIdOrderByObservedAtDesc(Long gatewayId);
}
