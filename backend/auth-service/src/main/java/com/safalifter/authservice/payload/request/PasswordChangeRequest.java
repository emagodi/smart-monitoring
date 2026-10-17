package com.safalifter.authservice.payload.request;

/**
 * Body for POST /api/v1/auth/change-password. Passwords travel in the request
 * body (never in the URL), so they stay out of access logs and browser history.
 */
public record PasswordChangeRequest(String currentPassword, String newPassword) {
}
