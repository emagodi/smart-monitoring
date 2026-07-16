package com.safalifter.authservice.repository;

import com.safalifter.authservice.entities.UserTypeEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserTypeRepository extends JpaRepository<UserTypeEntity, Long> {
    Optional<UserTypeEntity> findByName(String name);
}
