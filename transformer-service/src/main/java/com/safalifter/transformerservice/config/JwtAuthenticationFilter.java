package com.safalifter.transformerservice.config;

import io.micrometer.common.util.StringUtils;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import com.safalifter.transformerservice.enums.Role;

import java.io.IOException;
import java.util.List;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final RemoteUserService remoteUserService;

    private boolean shouldSkip(HttpServletRequest request) {
        String uri = request.getRequestURI();
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

        if (shouldSkip(request)) {
            filterChain.doFilter(request, response);
            return;
        }

        String authHeader = request.getHeader("Authorization");
        String jwt = null;
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            jwt = authHeader.substring(7);
        } else {
            jwt = jwtService.getJwtFromCookies(request);
        }

        if (StringUtils.isEmpty(jwt)) {
            filterChain.doFilter(request, response);
            return;
        }

        final String userEmail = jwtService.extractUserName(jwt);
        if (!StringUtils.isEmpty(userEmail) && org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication() == null) {
            Role role;
            try {
                role = remoteUserService.getRoleByEmail(userEmail);
            } catch (Exception ex) {
                role = Role.USER;
            }
            List<SimpleGrantedAuthority> authorities = role != null ? role.getAuthorities() : List.of(new SimpleGrantedAuthority("ROLE_USER"));
            User principal = new User(userEmail, "", authorities);
            if (jwtService.isTokenValid(jwt, principal)) {
                UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                        principal, null, authorities
                );
                authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(authToken);
            }
        }

        filterChain.doFilter(request, response);
    }
}