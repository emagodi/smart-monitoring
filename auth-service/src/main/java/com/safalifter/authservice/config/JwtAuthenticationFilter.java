package com.safalifter.authservice.config;

import io.micrometer.common.util.StringUtils;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import com.safalifter.authservice.service.JwtService;

import java.io.IOException;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;
    private final Logger log = LoggerFactory.getLogger(JwtAuthenticationFilter.class);

    public JwtAuthenticationFilter(JwtService jwtService, UserDetailsService userDetailsService) {
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
    }

    private boolean shouldSkip(HttpServletRequest request) {
        String uri = request.getRequestURI();
        // permit only specific auth endpoints and swagger resources without token
        if (uri.equals("/api/v1/auth/register") ||
                uri.equals("/api/v1/auth/authenticate") ||
                uri.equals("/api/v1/auth/refresh-token") ||
                uri.equals("/api/v1/auth/refresh-token-cookie")) {
            return true;
        }
        return uri.startsWith("/v2/api-docs") ||
                uri.startsWith("/v3/api-docs") ||
                uri.startsWith("/swagger") ||
                uri.contains("swagger-ui") ||
                uri.startsWith("/webjars");
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain) throws ServletException, IOException {

        try {
            if (shouldSkip(request)) {
                filterChain.doFilter(request, response);
                return;
            }

            String authHeader = request.getHeader("Authorization");
            String jwt = null;

            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                jwt = authHeader.substring(7);
            } else {
                // try cookie fallback
                jwt = jwtService.getJwtFromCookies(request);
            }

            if (StringUtils.isEmpty(jwt)) {
                // no token provided - let the security chain handle anonymous request
                filterChain.doFilter(request, response);
                return;
            }

            final String userEmail = jwtService.extractUserName(jwt);

            if (!StringUtils.isEmpty(userEmail) && org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication() == null) {
                UserDetails userDetails = userDetailsService.loadUserByUsername(userEmail);
                if (jwtService.isTokenValid(jwt, userDetails)) {
                    UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                            userDetails, null, userDetails.getAuthorities()
                    );
                    authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(authToken);
                }
            }

        } catch (Exception ex) {
            log.error("Failed to process JWT authentication: {}", ex.getMessage());
            // do not stop filter chain - let authentication entry point handle unauthorized responses
        }

        filterChain.doFilter(request, response);
    }
}
