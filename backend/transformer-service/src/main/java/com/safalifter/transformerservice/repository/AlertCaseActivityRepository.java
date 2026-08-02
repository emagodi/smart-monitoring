package com.safalifter.transformerservice.repository;

import com.safalifter.transformerservice.entities.AlertCaseActivity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AlertCaseActivityRepository extends JpaRepository<AlertCaseActivity, Long> {
    List<AlertCaseActivity> findAllByAlertCaseIdOrderByCreatedAtAsc(Long alertCaseId);
    void deleteAllByAlertCaseId(Long alertCaseId);
}
