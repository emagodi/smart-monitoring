package com.safalifter.transformerservice.repository;

import com.safalifter.transformerservice.entities.AlertDispatch;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface AlertDispatchRepository extends JpaRepository<AlertDispatch, Long> {
    List<AlertDispatch> findAllByAlertCaseIdOrderByIdDesc(Long alertCaseId);
    List<AlertDispatch> findAllByAlertCaseIdInOrderByIdDesc(Collection<Long> alertCaseIds);
    Optional<AlertDispatch> findByCrewToken(String crewToken);
    List<AlertDispatch> findAllByVehicleIdInAndStatusIn(Collection<Long> vehicleIds, Collection<com.safalifter.transformerservice.enums.DispatchStatus> statuses);
}
