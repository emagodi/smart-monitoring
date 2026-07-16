package com.safalifter.authservice.repository;

import com.safalifter.authservice.entities.RoleEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface RoleEntityRepository extends JpaRepository<RoleEntity, Long> {
    Optional<RoleEntity> findByName(String name);

    @Query(value = "select r.* from roles r join user_roles ur on ur.role_id = r.id where ur.user_id = ?1", nativeQuery = true)
    List<RoleEntity> findAllByUserId(Long userId);

    @Query(value = "select count(*) from user_roles where role_id = ?1", nativeQuery = true)
    long countUsersByRoleId(Long roleId);
}
