package com.safalifter.authservice.service.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.safalifter.authservice.entities.User;
import com.safalifter.authservice.exception.AuthenticationException;
import com.safalifter.authservice.exception.UserNotFoundException;
import com.safalifter.authservice.payload.request.AuthenticationRequest;
import com.safalifter.authservice.payload.request.RegisterRequest;
import com.safalifter.authservice.payload.request.UserUpdateRequest;
import com.safalifter.authservice.payload.response.AuthenticationResponse;
import com.safalifter.authservice.repository.UserRepository;
import com.safalifter.authservice.service.AuthenticationService;
import com.safalifter.authservice.service.EmailService;
import com.safalifter.authservice.service.JwtService;
import com.safalifter.authservice.service.RefreshTokenService;



import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.*;

@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class AuthenticationServiceImpl implements AuthenticationService {

    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final AuthenticationManager authenticationManager;
    private final RefreshTokenService refreshTokenService;
    private final EmailService emailService;
    private final NotificationService notificationService;



    @Override
    public AuthenticationResponse register(RegisterRequest request) {
        String generatedPassword = generateRandomPassword(12);

        User user = User.builder()
                .firstname(request.getFirstname())
                .lastname(request.getLastname())
                .email(request.getEmail())
                .password(passwordEncoder.encode(generatedPassword))
                .phone(request.getPhone())
                .role(request.getRole())
                .region(request.getRegion())
                .district(request.getDistrict())
                .depot(request.getDepot())
                .temporaryPassword(true)
                .build();

        user = userRepository.save(user);

        // Generate OTP and send email
        String otp = generateOtp();
        user.setOtp(otp);
        user.setOtpExpiry(LocalDateTime.now().plusMinutes(5));
        userRepository.save(user);

        notificationService.sendOtpSms(user.getPhone(), otp);

       // emailService.sendSimpleMessage(new MailBody(user.getEmail(), "Your OTP Code", "Your OTP code is: " + otp));
       // emailService.sendSimpleMessage(new MailBody(user.getEmail(), "Account Created", "Your password: " + generatedPassword));

        // If User implements UserDetails this will work. Otherwise build a UserDetails and pass to jwtService.
        String jwt = null;
        try {
            jwt = jwtService.generateToken(user);
        } catch (Exception e) {
            log.warn("Could not generate JWT for newly created user (ok for temporary password flow): {}", e.getMessage());
        }

        var refreshToken = refreshTokenService.createRefreshToken(user.getId());

        var roles = user.getRole().getAuthorities().stream()
                .map(SimpleGrantedAuthority::getAuthority)
                .toList();

        return AuthenticationResponse.builder()
                .accessToken(jwt)
                .email(user.getEmail())
                .id(user.getId())
                .firstname(user.getFirstname())
                .lastname(user.getLastname())
                .password(generatedPassword)
                .phone(user.getPhone())
                .region(user.getRegion())
                .district(user.getDistrict())
                .depot(user.getDepot())
                .refreshToken(refreshToken.getToken())
                .roles(roles)
                .temporaryPassword(user.isTemporaryPassword())
                .tokenType("BEARER")
                .message("User created successfully. An OTP has been sent to your email and or phone number.")
                .build();
    }

    @Override
    public String generateOtp() {
        Random random = new Random();
        int otp = 100000 + random.nextInt(900000);
        return String.valueOf(otp);
    }

    private String generateRandomPassword(int length) {
        String characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+";
        SecureRandom random = new SecureRandom();
        StringBuilder password = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            password.append(characters.charAt(random.nextInt(characters.length())));
        }
        return password.toString();
    }

    @Override
    public AuthenticationResponse authenticate(AuthenticationRequest request) {
        log.info("Authentication attempt for {}", request.getEmail());
        Optional<User> optionalUser = userRepository.findByEmail(request.getEmail());
        if (optionalUser.isEmpty()) {
            throw new AuthenticationException("Invalid email or password");
        }
        User user = optionalUser.get();

        try {
            authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(user.getEmail(), request.getPassword()));
        } catch (BadCredentialsException e) {
            log.error("Invalid credentials for {}", request.getEmail());
            throw new AuthenticationException("Invalid email or password");
        }
        String jwt = null;
        try {
            jwt = jwtService.generateToken(user);
        } catch (Exception e) {
            log.warn("Could not generate JWT: {}", e.getMessage());
        }

        var refreshToken = refreshTokenService.createRefreshToken(user.getId());

        var roles = user.getRole().getAuthorities().stream()
                .map(SimpleGrantedAuthority::getAuthority)
                .toList();

        return AuthenticationResponse.builder()
                .accessToken(jwt)
                .roles(roles)
                .email(user.getEmail())
                .id(user.getId())
                .firstname(user.getFirstname())
                .lastname(user.getLastname())
                .password(user.getPassword())
                .phone(user.getPhone())
                .region(user.getRegion())
                .district(user.getDistrict())
                .depot(user.getDepot())
                .temporaryPassword(user.isTemporaryPassword())
                .refreshToken(refreshToken.getToken())
                .tokenType("BEARER")
                .message("User Authenticated Successfully")
                .build();
    }

    public User getUserById(Long id) {
        return userRepository.findById(id).orElse(null);
    }

    @Transactional
    public User updateUser(Long userId, UserUpdateRequest userUpdateRequest) {
        User existingUser = userRepository.findById(userId).orElseThrow(() -> new UserNotFoundException("User not found with ID: " + userId));
        copyNonNullProperties(userUpdateRequest, existingUser);
        return userRepository.save(existingUser);
    }

    public void copyNonNullProperties(Object source, Object target) {
        var src = new org.springframework.beans.BeanWrapperImpl(source);
        Set<String> ignoreSet = new HashSet<>();
        for (var pd : src.getPropertyDescriptors()) {
            Object srcValue = src.getPropertyValue(pd.getName());
            if (srcValue == null) {
                ignoreSet.add(pd.getName());
            }
        }
        ignoreSet.add("roles");
        org.springframework.beans.BeanUtils.copyProperties(source, target, ignoreSet.toArray(new String[0]));
    }

    public void changePassword(String email, String currentPassword, String newPassword) {
        Optional<User> optionalUser = userRepository.findByEmail(email);
        if (optionalUser.isPresent()) {
            User user = optionalUser.get();
            if (!passwordEncoder.matches(currentPassword, user.getPassword())) {
                throw new IllegalArgumentException("Invalid current password");
            }
            user.setPassword(passwordEncoder.encode(newPassword));
            user.setTemporaryPassword(false);
            userRepository.save(user);
        } else {
            throw new IllegalArgumentException("User not found with the provided email");
        }
    }
}
