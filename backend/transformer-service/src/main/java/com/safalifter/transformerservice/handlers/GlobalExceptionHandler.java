package com.safalifter.transformerservice.handlers;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ErrorResponse> handleResponseStatusException(
            ResponseStatusException ex,
            HttpServletRequest request
    ) {
        ErrorResponse body = ErrorResponse.builder()
                .status(ex.getStatusCode().value())
                .error(ex.getStatusCode().toString())
                .timestamp(Instant.now())
                .message(ex.getReason())
                .path(request.getRequestURI())
                .build();
        return ResponseEntity.status(ex.getStatusCode()).body(body);
    }
}
