package com.safalifter.authservice.service;

import com.safalifter.authservice.entities.RefreshToken;
import com.safalifter.authservice.entities.User;
import com.safalifter.authservice.enums.Role;
import com.safalifter.authservice.payload.request.AuthenticationRequest;
import com.safalifter.authservice.payload.request.RegisterRequest;
import com.safalifter.authservice.payload.response.AuthenticationResponse;
import com.safalifter.authservice.repository.UserRepository;
import com.safalifter.authservice.service.impl.AuthenticationServiceImpl;
import com.safalifter.authservice.service.impl.NotificationService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthenticationServiceImplTest {

    @Mock PasswordEncoder passwordEncoder;
    @Mock com.safalifter.authservice.service.JwtService jwtService;
    @Mock UserRepository userRepository;
    @Mock AuthenticationManager authenticationManager;
    @Mock com.safalifter.authservice.service.RefreshTokenService refreshTokenService;
    @Mock com.safalifter.authservice.service.EmailService emailService;
    @Mock NotificationService notificationService;

    @InjectMocks AuthenticationServiceImpl authenticationService;

    @Test
    void authenticate_includes_ids_in_response() {
        User user = User.builder()
                .id(1L)
                .firstname("Edwin")
                .lastname("Magodi")
                .email("user@example.com")
                .password("pass")
                .phone("+263000000000")
                .role(Role.DEPOT_FOREMAN)
                .region("Harare")
                .district("Harare_West")
                .depot("Southerton")
                .regionId(1L)
                .districtId(1L)
                .depotId(1L)
                .build();

        when(userRepository.findByEmail("user@example.com")).thenReturn(Optional.of(user));
        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class))).thenReturn(mock(Authentication.class));
        when(jwtService.generateToken(user)).thenReturn("jwt");
        RefreshToken rt = RefreshToken.builder().token("rt").expiryDate(Instant.now().plusSeconds(60)).user(user).revoked(false).build();
        when(refreshTokenService.createRefreshToken(1L)).thenReturn(rt);

        AuthenticationRequest req = AuthenticationRequest.builder().email("user@example.com").password("pass").build();
        AuthenticationResponse res = authenticationService.authenticate(req);

        assertEquals(1L, res.getRegionId());
        assertEquals(1L, res.getDistrictId());
        assertEquals(1L, res.getDepotId());
        assertEquals("jwt", res.getAccessToken());
        assertEquals("rt", res.getRefreshToken());
    }

    @Test
    void register_includes_ids_in_response() {
        when(passwordEncoder.encode(anyString())).thenReturn("enc");
        when(jwtService.generateToken(any(User.class))).thenReturn("jwt");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(2L);
            return u;
        });
        RefreshToken rt = RefreshToken.builder().token("rt").expiryDate(Instant.now().plusSeconds(60)).user(User.builder().id(2L).build()).revoked(false).build();
        when(refreshTokenService.createRefreshToken(2L)).thenReturn(rt);

        RegisterRequest req = RegisterRequest.builder()
                .firstname("F")
                .lastname("L")
                .email("new@example.com")
                .phone("+263")
                .role(Role.USER)
                .region("Harare")
                .district("Harare_West")
                .depot("Southerton")
                .regionId(1L)
                .districtId(1L)
                .depotId(1L)
                .build();

        AuthenticationResponse res = authenticationService.register(req);
        assertEquals(1L, res.getRegionId());
        assertEquals(1L, res.getDistrictId());
        assertEquals(1L, res.getDepotId());
        assertEquals("jwt", res.getAccessToken());
        assertEquals("rt", res.getRefreshToken());
    }
}