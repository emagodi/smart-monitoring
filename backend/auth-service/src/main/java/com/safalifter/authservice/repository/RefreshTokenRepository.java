package com.safalifter.authservice.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.safalifter.authservice.entities.RefreshToken;

import java.util.Optional;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

    Optional<RefreshToken> findByToken(String token);

}
