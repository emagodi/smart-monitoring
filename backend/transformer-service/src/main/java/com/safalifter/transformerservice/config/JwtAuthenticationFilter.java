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

    /** Access profiles cached briefly: previously every API request made a Feign call to auth-service. */
    private static final long PROFILE_TTL_MS = 60_000;
    private final java.util.concurrent.ConcurrentHashMap<String, CachedProfile> profileCache = new java.util.concurrent.ConcurrentHashMap<>();

    private record CachedProfile(UserAccessProfile profile, long expiresAt) {
    }

    private UserAccessProfile loadProfile(String email) {
        long now = System.currentTimeMillis();
        CachedProfile cached = profileCache.get(email);
        if (cached != null && cached.expiresAt() > now) {
            return cached.profile();
        }
        UserAccessProfile fresh = remoteUserService.getAccessByEmail(email);
        if (fresh != null) {
            profileCache.put(email, new CachedProfile(fresh, now + PROFILE_TTL_MS));
            if (profileCache.size() > 5_000) {
                profileCache.entrySet().removeIf(e -> e.getValue().expiresAt() <= now);
            }
        }
        return fresh;
    }

    private boolean shouldSkip(HttpServletRequest request) {
        String uri = request.getRequestURI();
        return uri.startsWith("/v2/api-docs") ||
                uri.startsWith("/v3/api-docs") ||
                uri.startsWith("/swagger") ||
                uri.contains("swagger-ui") ||
                uri.startsWith("/webjars") ||
                uri.startsWith("/internal/integrations/loriot/");
    }

    private static boolean looksLikeJwt(String token) {
        if (token == null) return false;
        int dotCount = 0;
        for (int i = 0; i < token.length(); i++) {
            char c = token.charAt(i);
            if (c == '.') dotCount++;
            else if (!(c == '-' || c == '_' || Character.isLetterOrDigit(c))) return false;
        }
        return dotCount == 2;
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

        if (StringUtils.isEmpty(jwt) || !looksLikeJwt(jwt)) {
            filterChain.doFilter(request, response);
            return;
        }

        final String userEmail;
        try {
            userEmail = jwtService.extractUserName(jwt);
        } catch (Exception ex) {
            filterChain.doFilter(request, response);
            return;
        }
        if (!StringUtils.isEmpty(userEmail) && org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication() == null) {
            UserAccessProfile accessProfile;
            try {
                accessProfile = loadProfile(userEmail);
            } catch (Exception ex) {
                accessProfile = UserAccessProfile.builder().role(Role.USER).build();
            }
            Role role = accessProfile != null && accessProfile.getRole() != null ? accessProfile.getRole() : Role.USER;
            List<SimpleGrantedAuthority> authorities = new java.util.ArrayList<>(
                    role != null ? role.getAuthorities() : List.of(new SimpleGrantedAuthority("ROLE_USER")));
            if (accessProfile != null && accessProfile.getPermissions() != null) {
                // Tick-box permissions from the Roles admin become Spring authorities ("response.dispatch", ...)
                authorities.add(new SimpleGrantedAuthority(AccessScopeService.PERMISSIONS_LOADED));
                accessProfile.getPermissions().forEach(p -> authorities.add(new SimpleGrantedAuthority(p)));
            }
            AuthenticatedUserPrincipal principal = new AuthenticatedUserPrincipal(
                    userEmail,
                    accessProfile != null ? accessProfile.getUserType() : null,
                    accessProfile != null ? accessProfile.getSupplierId() : null,
                    accessProfile != null ? accessProfile.getSupplierCode() : null,
                    accessProfile != null ? accessProfile.getSupplierName() : null,
                    accessProfile != null ? accessProfile.getDepotId() : null,
                    authorities
            );
            try {
                if (jwtService.isTokenValid(jwt, principal)) {
                    UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                            principal, null, authorities
                    );
                    authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(authToken);
                }
            } catch (Exception ignored) {
                // Invalid JWT signature/claims — proceed unauthenticated
            }
        }

        filterChain.doFilter(request, response);
    }
}
