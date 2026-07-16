package com.safalifter.authservice.service.impl;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.safalifter.authservice.entities.PermissionEntity;
import com.safalifter.authservice.entities.RoleEntity;
import com.safalifter.authservice.entities.User;
import com.safalifter.authservice.entities.UserTypeEntity;
import com.safalifter.authservice.exception.AuthenticationException;
import com.safalifter.authservice.exception.UserNotFoundException;
import com.safalifter.authservice.payload.request.AuthenticationRequest;
import com.safalifter.authservice.payload.request.RegisterRequest;
import com.safalifter.authservice.payload.request.UserUpdateRequest;
import com.safalifter.authservice.payload.response.AuthenticationResponse;
import com.safalifter.authservice.repository.RoleEntityRepository;
import com.safalifter.authservice.repository.UserRepository;
import com.safalifter.authservice.service.AuthenticationService;
import com.safalifter.authservice.service.EmailService;
import com.safalifter.authservice.service.JwtService;
import com.safalifter.authservice.service.RefreshTokenService;



import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class AuthenticationServiceImpl implements AuthenticationService {

    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final RoleEntityRepository roleEntityRepository;
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
                .status("ACTIVE")
                .region(request.getRegion())
                .regionId(request.getRegionId())
                .district(request.getDistrict())
                .districtId(request.getDistrictId())
                .depot(request.getDepot())
                .depotId(request.getDepotId())
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

        return buildAuthenticationResponse(user, jwt, refreshToken.getToken(), generatedPassword,
                "User created successfully. An OTP has been sent to your email and or phone number.");
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
        Optional<User> optionalUser = userRepository.findDetailedByEmail(request.getEmail());
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

        user.setLastLoginAt(LocalDateTime.now());
        userRepository.save(user);

        return buildAuthenticationResponse(user, jwt, refreshToken.getToken(), user.getPassword(),
                "User Authenticated Successfully");
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
        Optional<User> optionalUser = userRepository.findDetailedByEmail(email);
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

    private AuthenticationResponse buildAuthenticationResponse(User user, String jwt, String refreshToken, String password, String message) {
        return AuthenticationResponse.builder()
                .accessToken(jwt)
                .roles(resolveRoleNames(user))
                .permissions(resolvePermissionNames(user))
                .email(user.getEmail())
                .id(user.getId())
                .firstname(user.getFirstname())
                .lastname(user.getLastname())
                .password(password)
                .phone(user.getPhone())
                .employeeNumber(user.getEmployeeNumber())
                .status(user.getStatus())
                .userType(user.getUserType() != null ? user.getUserType().getName() : null)
                .region(user.getRegion())
                .district(user.getDistrict())
                .depot(user.getDepot())
                .regionId(user.getRegionId())
                .districtId(user.getDistrictId())
                .depotId(user.getDepotId())
                .temporaryPassword(user.isTemporaryPassword())
                .refreshToken(refreshToken)
                .tokenType("BEARER")
                .message(message)
                .build();
    }

    private List<String> resolveRoleNames(User user) {
        List<RoleEntity> resolvedRoles = resolveAssignedRoles(user);
        if (!resolvedRoles.isEmpty()) {
            return resolvedRoles.stream()
                    .map(RoleEntity::getName)
                    .sorted(String::compareToIgnoreCase)
                    .toList();
        }

        if (user.getRole() != null) {
            return List.of(user.getRole().name());
        }

        return List.of();
    }

    private List<String> resolvePermissionNames(User user) {
        List<RoleEntity> resolvedRoles = resolveAssignedRoles(user);
        if (!resolvedRoles.isEmpty()) {
            return resolvedRoles.stream()
                    .flatMap(role -> role.getPermissions().stream())
                    .map(PermissionEntity::getName)
                    .distinct()
                    .sorted(String::compareToIgnoreCase)
                    .collect(Collectors.toList());
        }

        if (user.getRole() != null) {
            return user.getRole().getPrivileges().stream()
                    .map(Enum::name)
                    .sorted(String::compareToIgnoreCase)
                    .collect(Collectors.toList());
        }

        return List.of();
    }

    private List<RoleEntity> resolveAssignedRoles(User user) {
        if (user.getId() == null) {
            return List.of();
        }
        return roleEntityRepository.findAllByUserId(user.getId());
    }
}
