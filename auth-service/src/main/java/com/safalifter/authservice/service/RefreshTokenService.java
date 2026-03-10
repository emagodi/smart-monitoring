package com.safalifter.authservice.service;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseCookie;
import com.safalifter.authservice.entities.RefreshToken;
import com.safalifter.authservice.payload.request.RefreshTokenRequest;
import com.safalifter.authservice.payload.response.RefreshTokenResponse;

import java.util.Optional;

public interface RefreshTokenService {

    RefreshToken createRefreshToken(Long userId);
    RefreshToken verifyExpiration(RefreshToken token);
    Optional<RefreshToken> findByToken(String token);
    RefreshTokenResponse generateNewToken(RefreshTokenRequest request);
    ResponseCookie generateRefreshTokenCookie(String token);
    String getRefreshTokenFromCookies(HttpServletRequest request);
    void deleteByToken(String token);
    ResponseCookie getCleanRefreshTokenCookie();
}
