package com.safalifter.authservice.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.safalifter.authservice.entities.SmsEntity;

import java.util.List;

public interface SmsRepository extends JpaRepository<SmsEntity, Long> {
    List<SmsEntity> findBySentFalse();
}
