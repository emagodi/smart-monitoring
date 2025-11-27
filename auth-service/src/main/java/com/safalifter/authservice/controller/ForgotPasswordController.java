package com.safalifter.authservice.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import com.safalifter.authservice.entities.ForgotPassword;
import com.safalifter.authservice.entities.User;
import com.safalifter.authservice.payload.request.ChangePassword;
import com.safalifter.authservice.payload.request.MailBody;
import com.safalifter.authservice.repository.ForgotPasswordRepository;
import com.safalifter.authservice.repository.UserRepository;
import com.safalifter.authservice.service.impl.EmailServiceImpl;

import java.time.Instant;
import java.util.Date;
import java.util.Objects;
import java.util.Optional;
import java.util.Random;

@Tag(name = "PASSWORD RESET", description = "These are endpoints for the process to reset password")
@RestController
@RequiredArgsConstructor
@RequestMapping("/forgotPassword")
public class ForgotPasswordController {


    private final UserRepository userRepository;
    private final EmailServiceImpl emailService;

    private final ForgotPasswordRepository forgotPasswordRepository;

    private final PasswordEncoder passwordEncoder;

    // send mail for email verification
    @PostMapping("/verifyMail/{email}")
    @Operation(summary = "Endpoint to enter your email which needs to receive the otp",
            description = "This endpoint will check for a valid register user email and send an otp")
    public ResponseEntity<String> verifyEmail(@PathVariable String email) {
        // Find the user by email
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("Please provide a valid email: " + email));

        // Generate a new OTP
        int otp = otpGenerator();

        // Prepare email body
        MailBody mailBody = MailBody.builder()
                .to(email)
                .text("This is the OTP for your Forgot Password request: " + otp)
                .subject("OTP for Forgot Password request")
                .build();

        // Check if an existing OTP entry exists for the user
        Optional<ForgotPassword> existingOtp = forgotPasswordRepository.findByUser(user);
        if (existingOtp.isPresent()) {
            // Update the existing OTP
            ForgotPassword fp = existingOtp.get();
            fp.setOtp(otp);  // Update OTP value
            fp.setExpirationTime(new Date(System.currentTimeMillis() + 70 * 1000)); // Update expiration time
            forgotPasswordRepository.save(fp); // Save the changes
        } else {
            // Create a new ForgotPassword entry if none exists
            ForgotPassword fp = ForgotPassword.builder()
                    .otp(otp)
                    .expirationTime(new Date(System.currentTimeMillis() + 70 * 1000)) // Set expiration time
                    .user(user)
                    .build();
            forgotPasswordRepository.save(fp); // Save the new entry
        }

        // Send the email
        emailService.sendSimpleMessage(mailBody);

        return ResponseEntity.ok("Email sent for verification!");
    }

    @PostMapping("/verifyOtp/{otp}/{email}")
    @Operation(summary = "Endpoint to verify the email using the shared otp",
            description = "This endpoint will require otp and the used email to valid otp before proceeding to change password")
    public ResponseEntity<String> verifyOtp(@PathVariable Integer otp, @PathVariable String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("Please provide an valid email!"));

        ForgotPassword fp = forgotPasswordRepository.findByOtpAndUser(otp, user)
                .orElseThrow(() -> new RuntimeException("Invalid OTP for email: " + email));

        if (fp.getExpirationTime().before(Date.from(Instant.now()))) {
            forgotPasswordRepository.deleteById(fp.getFpid());
            return new ResponseEntity<>("OTP has expired!", HttpStatus.EXPECTATION_FAILED);
        }

        return ResponseEntity.ok("OTP verified!");
    }

    @PutMapping("/changePassword/{email}")
    @Operation(summary = "Endpoint to change password with the still valid password",
            description = "This endpoint will change the user password if the otp is still valid")
    public ResponseEntity<String> changePasswordHandler(@RequestBody ChangePassword changePassword,
                                                        @PathVariable String email) {
        if (!Objects.equals(changePassword.password(), changePassword.repeatPassword())) {
            return new ResponseEntity<>("Please enter the password again!", HttpStatus.EXPECTATION_FAILED);
        }

        // Encode the new password
        String encodedPassword = passwordEncoder.encode(changePassword.password());

        // Update the password and set temporary password to false
        userRepository.updatePasswordAndSetTemporaryFalse(email, encodedPassword);

        return ResponseEntity.ok("Password has been changed!");
    }


    private Integer otpGenerator() {
        Random random = new Random();
        return random.nextInt(100_000, 999_999);
    }

}
