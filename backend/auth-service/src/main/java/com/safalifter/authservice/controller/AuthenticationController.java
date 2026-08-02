package com.safalifter.authservice.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.annotation.*;
import com.safalifter.authservice.entities.User;
import com.safalifter.authservice.enums.TokenType;
import com.safalifter.authservice.exception.AuthenticationException;
import com.safalifter.authservice.exception.UserNotFoundException;
import com.safalifter.authservice.payload.request.*;
import com.safalifter.authservice.payload.response.AuthenticationResponse;
import com.safalifter.authservice.payload.response.ChatCommandUserResponse;
import com.safalifter.authservice.payload.response.NotificationDirectoryEntryResponse;
import com.safalifter.authservice.payload.response.NotificationDirectoryWorkspaceResponse;
import com.safalifter.authservice.payload.response.NotificationPreferenceResponse;
import com.safalifter.authservice.payload.response.NotificationRecipientResponse;
import com.safalifter.authservice.payload.response.RefreshTokenResponse;
import com.safalifter.authservice.payload.response.UserAccessResponse;
import com.safalifter.authservice.repository.UserRepository;
import com.safalifter.authservice.service.AuthenticationService;
import com.safalifter.authservice.service.ChatCommandAccessService;
import com.safalifter.authservice.service.NotificationDirectoryService;
import com.safalifter.authservice.service.NotificationPreferenceService;
import com.safalifter.authservice.service.RbacAuthorizationService;
import com.safalifter.authservice.service.EmailService;
import com.safalifter.authservice.service.JwtService;
import com.safalifter.authservice.service.RefreshTokenService;

import java.time.LocalDateTime;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;


@Tag(name = "Authentication Endpoints", description = "The Authentication APIs. Contains operations like login, logout, refresh-token etc.")
@RestController
@RequestMapping("/api/v1/auth")
@SecurityRequirements() /*
This API won't have any security requirements. Therefore, we need to override the default security requirement configuration
with @SecurityRequirements()
*/
@RequiredArgsConstructor
@Slf4j
public class AuthenticationController {

    private final AuthenticationService authenticationService;
    private final RefreshTokenService refreshTokenService;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;

    private final EmailService emailService;

    private final UserRepository userRepository;
    private final RbacAuthorizationService rbacAuthorizationService;
    private final NotificationPreferenceService notificationPreferenceService;
    private final NotificationDirectoryService notificationDirectoryService;
    private final ChatCommandAccessService chatCommandAccessService;

    @PostMapping("/register")
    @Operation(summary = "Register New User",
            description = "Create new user by posting firstname, lastname, email, password, role, etc.")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest request) {
        try {
            // Call the register method without admin logic
            AuthenticationResponse authenticationResponse = authenticationService.register(request);

            // Generate cookies for JWT and Refresh Token
            ResponseCookie jwtCookie = jwtService.generateJwtCookie(authenticationResponse.getAccessToken());
            ResponseCookie refreshTokenCookie = refreshTokenService.generateRefreshTokenCookie(authenticationResponse.getRefreshToken());

            // Return the response with cookies
            return ResponseEntity.ok()
                    .header(HttpHeaders.SET_COOKIE, jwtCookie.toString())
                    .header(HttpHeaders.SET_COOKIE, refreshTokenCookie.toString())
                    .body(authenticationResponse); // Return the authentication response
        } catch (DataIntegrityViolationException e) {
            String message = extractDuplicateEntryMessage(e.getMessage());
            if (message != null) {
                // Return Conflict status with a plain string message
                return ResponseEntity.status(HttpStatus.CONFLICT)
                        .body("Email and or accessNumber already exists: " + message); // Return the duplicate entry message
            }
            // Handle other DataIntegrityViolationException cases if necessary
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("An unexpected error occurred: " + e.getMessage()); // Return error message as a string
        }
    }

    @PostMapping("/authenticate")
    @Operation(
            responses = {
                    @ApiResponse(
                            description = "Success",
                            responseCode = "200"
                    ),
                    @ApiResponse(
                            description = "Unauthorized",
                            responseCode = "401",
                            content = {@Content(schema = @Schema(implementation = ErrorResponse.class), mediaType = "application/json")}
                    )
            }
    )

    public ResponseEntity<?> authenticate(@RequestBody AuthenticationRequest request) {
        log.info("Received authentication request for email: {}", request.getEmail());

        try {
            AuthenticationResponse authenticationResponse = authenticationService.authenticate(request);
            ResponseCookie jwtCookie = jwtService.generateJwtCookie(authenticationResponse.getAccessToken());
            ResponseCookie refreshTokenCookie = refreshTokenService.generateRefreshTokenCookie(authenticationResponse.getRefreshToken());

            return ResponseEntity.ok()
                    .header(HttpHeaders.SET_COOKIE, jwtCookie.toString())
                    .header(HttpHeaders.SET_COOKIE, refreshTokenCookie.toString())
                    .body(authenticationResponse);
        } catch (AuthenticationException e) {
            log.error("Authentication failed for email: {}", request.getEmail(), e);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body("Invalid credentials");
        }
    }
    @PostMapping("/refresh-token")
    public ResponseEntity<RefreshTokenResponse> refreshToken(@RequestBody RefreshTokenRequest request) {
        return ResponseEntity.ok(refreshTokenService.generateNewToken(request));
    }

    @PostMapping("/refresh-token-cookie")
    public ResponseEntity<Void> refreshTokenCookie(HttpServletRequest request) {
        String refreshToken = refreshTokenService.getRefreshTokenFromCookies(request);
        RefreshTokenResponse refreshTokenResponse = refreshTokenService
                .generateNewToken(new RefreshTokenRequest(refreshToken));
        ResponseCookie NewJwtCookie = jwtService.generateJwtCookie(refreshTokenResponse.getAccessToken());
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, NewJwtCookie.toString())
                .build();
    }
    @GetMapping("/info")
    public Authentication getAuthentication(@RequestBody AuthenticationRequest request){
        return     authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(),request.getPassword()));
    }
    @PostMapping("/logout")
    @Operation(summary = "Logout",
            description = "End point to logout")
    public ResponseEntity<Void> logout(HttpServletRequest request) {
        String refreshToken = refreshTokenService.getRefreshTokenFromCookies(request);

        if (refreshToken != null) {
            try {
                refreshTokenService.deleteByToken(refreshToken);
                log.info("Successfully deleted refresh token: {}", refreshToken);
            } catch (Exception e) {
                log.error("Error deleting refresh token: {}", refreshToken, e);
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
            }
        } else {
            log.warn("No refresh token found in cookies for logout");
        }

        ResponseCookie jwtCookie = jwtService.getCleanJwtCookie();
        ResponseCookie refreshTokenCookie = refreshTokenService.getCleanRefreshTokenCookie();

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, jwtCookie.toString())
                .header(HttpHeaders.SET_COOKIE, refreshTokenCookie.toString())
                .build();
    }

    @GetMapping("/user/email/{email}")
    @Operation(summary = "Find Role By Email",
            description = "Returns the role associated with the given user email.")
    public ResponseEntity<com.safalifter.authservice.enums.Role> getRoleByEmail(@PathVariable String email) {
        return userRepository.findByEmail(email)
                .map(User::getRole)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.ok(com.safalifter.authservice.enums.Role.USER));
    }

    @GetMapping("/access/email/{email}")
    @Operation(summary = "Find user access profile by email",
            description = "Returns the legacy role and supplier scope associated with the given user email.")
    public ResponseEntity<UserAccessResponse> getAccessByEmail(@PathVariable String email) {
        return userRepository.findDetailedByEmail(email)
                .map(user -> UserAccessResponse.builder()
                        .role(user.getRole() != null ? user.getRole() : com.safalifter.authservice.enums.Role.USER)
                        .userType(user.getUserType() != null ? user.getUserType().getName() : null)
                        .supplierId(user.getSupplier() != null ? user.getSupplier().getId() : null)
                        .supplierCode(user.getSupplier() != null ? user.getSupplier().getCode() : null)
                        .supplierName(user.getSupplier() != null ? user.getSupplier().getName() : null)
                        .depotId(user.getDepotId())
                        .build())
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.ok(UserAccessResponse.builder()
                        .role(com.safalifter.authservice.enums.Role.USER)
                        .build()));
    }

    @GetMapping("user/id/{id}")
    @Operation(summary = "Find User By User Id",
            description = "This endpoint will allow you to get a particular user by their user id.")
    // @PreAuthorize("hasAuthority('READ_PRIVILEGE') and hasAnyRole('ADMIN' , 'SUPERADMIN', 'TEACHER')")
    public ResponseEntity<?> getUserById(@PathVariable Long id) {
        User user = authenticationService.getUserById(id);
        if (user != null) {
            return ResponseEntity.ok(user); // Return 200 OK with user entity
        } else {
            String notFoundMessage = "User not found for ID: " + id;
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(notFoundMessage); // Return 404 Not Found with message
        }
    }
    @PutMapping("update/id/{userId}")
    @Operation(summary = "Endpoint to update user by id",
            description = "This endpoint will allow you to update user by id. If you are updating to an already existing user it will show email already exists message")
    public ResponseEntity<?> updateUser(
            @PathVariable Long userId,
            @RequestBody UserUpdateRequest userUpdateRequest) {
        System.out.println(userUpdateRequest);
        try {
            User updatedUser = authenticationService.updateUser(userId, userUpdateRequest);
            return ResponseEntity.ok(updatedUser); // Return the updated User entity
        } catch (DataIntegrityViolationException e) {
            String message = extractDuplicateEntryMessage(e.getMessage());
            if (message != null) {
                return ResponseEntity.status(HttpStatus.CONFLICT)
                        .body(message); // Return the extracted duplicate entry message
            }
            // Handle other DataIntegrityViolationException cases if necessary
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("An unexpected error occurred: " + e.getMessage()); // Include original message for debugging
        }
    }

    @GetMapping("/users")
    @Operation(summary = "List all users")
    @PreAuthorize("@rbacAuthorizationService.hasPermission(authentication, 'users.read')")
    public ResponseEntity<List<User>> listAllUsers() {
        List<User> users = userRepository.findAll();
        return ResponseEntity.ok(users);
    }

    @GetMapping("/me/notification-preferences")
    public ResponseEntity<List<NotificationPreferenceResponse>> getMyNotificationPreferences(Authentication authentication) {
        Long userId = resolveCurrentUserId(authentication);
        return ResponseEntity.ok(notificationPreferenceService.getPreferencesForUser(userId));
    }

    @PutMapping("/me/notification-preferences")
    public ResponseEntity<List<NotificationPreferenceResponse>> updateMyNotificationPreferences(
            Authentication authentication,
            @RequestBody NotificationPreferenceUpdateRequest request
    ) {
        Long userId = resolveCurrentUserId(authentication);
        return ResponseEntity.ok(notificationPreferenceService.updatePreferencesForUser(userId, request));
    }

    @GetMapping("/internal/notification-routing/users")
    public ResponseEntity<List<NotificationRecipientResponse>> getNotificationRecipients(
            @RequestParam com.safalifter.authservice.enums.NotificationType notificationType,
            @RequestParam(required = false) String supplierCode,
            @RequestParam(required = false) Long depotId
    ) {
        return ResponseEntity.ok(notificationPreferenceService.resolveRecipients(notificationType, supplierCode, depotId));
    }

    @GetMapping("/internal/chat-command-users/resolve")
    public ResponseEntity<ChatCommandUserResponse> resolveChatCommandUser(@RequestParam String contact) {
        return ResponseEntity.ok(chatCommandAccessService.resolveUserByContact(contact));
    }

    @GetMapping("/notification-directory")
    public ResponseEntity<NotificationDirectoryWorkspaceResponse> getNotificationDirectoryWorkspace(
            Authentication authentication,
            @RequestParam(required = false) String supplierCode
    ) {
        return ResponseEntity.ok(notificationDirectoryService.getWorkspace(authentication, supplierCode));
    }

    @PostMapping("/notification-directory")
    public ResponseEntity<NotificationDirectoryEntryResponse> createNotificationDirectoryEntry(
            Authentication authentication,
            @RequestBody NotificationDirectoryEntryRequest request
    ) {
        return ResponseEntity.ok(notificationDirectoryService.createEntry(authentication, request));
    }

    @PutMapping("/notification-directory/{entryId}")
    public ResponseEntity<NotificationDirectoryEntryResponse> updateNotificationDirectoryEntry(
            Authentication authentication,
            @PathVariable Long entryId,
            @RequestBody NotificationDirectoryEntryRequest request
    ) {
        return ResponseEntity.ok(notificationDirectoryService.updateEntry(authentication, entryId, request));
    }

    @DeleteMapping("/notification-directory/{entryId}")
    public ResponseEntity<Void> deleteNotificationDirectoryEntry(
            Authentication authentication,
            @PathVariable Long entryId
    ) {
        notificationDirectoryService.deleteEntry(authentication, entryId);
        return ResponseEntity.noContent().build();
    }

    // Extract duplicate entry message using regex
    private String extractDuplicateEntryMessage(String errorMessage) {
        String regex = "Duplicate entry '([^']+)'";
        Pattern pattern = Pattern.compile(regex);
        Matcher matcher = pattern.matcher(errorMessage);
        if (matcher.find()) {
            return " " + matcher.group(0); // Return the matched duplicate entry message
        }
        return null; // Return null if no match is found
    }

    @PostMapping("/change-password/{email}/{currentPassword}/{newPassword}")
    @Operation(summary = "Endpoint to change password",
            description = "This endpoint will allow you to change password by entering old password and new password. If the two are different, error is displayed")
    public ResponseEntity<String> changePassword(
            @PathVariable String email,
            @PathVariable String currentPassword,
            @PathVariable String newPassword) {
        try {
            authenticationService.changePassword(email, currentPassword, newPassword);
            return ResponseEntity.ok("Password changed successfully");
        } catch (IllegalArgumentException e) {
            // Return the message for invalid old password
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            // Handle the specific case for invalid old password
            return ResponseEntity.badRequest().body("Invalid old password.");
        }
    }

    // OTP flow removed: authenticate now returns tokens directly

    private Long resolveCurrentUserId(Authentication authentication) {
        String email = authentication != null ? authentication.getName() : null;
        if (email == null || email.isBlank()) {
            throw new UserNotFoundException("Current user could not be resolved");
        }
        return userRepository.findDetailedByEmail(email)
                .map(User::getId)
                .orElseThrow(() -> new UserNotFoundException("User not found with email: " + email));
    }

}
