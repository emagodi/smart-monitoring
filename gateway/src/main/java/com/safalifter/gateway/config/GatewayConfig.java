package com.safalifter.gateway.config;

import com.safalifter.gateway.filter.JwtAuthenticationFilter;
import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.reactive.CorsWebFilter;
import org.springframework.web.cors.reactive.UrlBasedCorsConfigurationSource;
import java.util.List;

@Configuration
public class GatewayConfig {
    private final JwtAuthenticationFilter filter;

    public GatewayConfig(JwtAuthenticationFilter filter) {
        this.filter = filter;
    }

    @Bean
    public RouteLocator routes(RouteLocatorBuilder builder) {
        return builder.routes()
                .route("notification-service", r -> r.path("/v1/notification/**")
                        .filters(f -> f.filter(filter))
                        .uri("lb://notification-service"))

                .route("auth-service", r -> r.path("/api/v1/auth/**")
                        .uri("lb://auth-service"))

                .route("auth-regions", r -> r.path("/api/v1/regions/**")
                        .filters(f -> f.filter(filter))
                        .uri("lb://auth-service"))

                .route("auth-districts", r -> r.path("/api/v1/districts/**")
                        .filters(f -> f.filter(filter))
                        .uri("lb://auth-service"))

                .route("auth-depots", r -> r.path("/api/v1/depots/**")
                        .filters(f -> f.filter(filter))
                        .uri("lb://auth-service"))

                .route("transformer-transformers", r -> r.path("/api/v1/transformers/**")
                        .filters(f -> f.filter(filter))
                        .uri("lb://transformer-service"))

                .route("transformer-sensors", r -> r.path("/api/v1/sensors/**")
                        .filters(f -> f.filter(filter))
                        .uri("lb://transformer-service"))

                .route("transformer-sensor-readings", r -> r.path("/api/v1/sensor-readings/**")
                        .filters(f -> f.filter(filter))
                        .uri("lb://transformer-service"))

                .route("transformer-alerts", r -> r.path("/api/v1/alerts/**")
                        .filters(f -> f.filter(filter))
                        .uri("lb://transformer-service"))

                .route("auth-swagger-ui", r -> r.path("/auth/swagger-ui/**", "/auth/swagger-ui.html")
                        .filters(f -> f.rewritePath("/auth/(?<segment>.*)", "/${segment}"))
                        .uri("lb://auth-service"))

                .route("auth-openapi", r -> r.path("/auth/v3/api-docs/**")
                        .filters(f -> f.rewritePath("/auth/(?<segment>.*)", "/${segment}"))
                        .uri("lb://auth-service"))

                .route("auth-openapi-root", r -> r.path("/v3/api-docs/**")
                        .uri("lb://auth-service"))
                .route("transformer-swagger-ui", r -> r.path("/transformer/swagger-ui/**", "/transformer/swagger-ui.html")
                        .filters(f -> f.rewritePath("/transformer/(?<segment>.*)", "/${segment}"))
                        .uri("lb://transformer-service"))

                .route("transformer-openapi", r -> r.path("/transformer/v3/api-docs/**")
                        .filters(f -> f.rewritePath("/transformer/(?<segment>.*)", "/${segment}"))
                        .uri("lb://transformer-service"))
                .route("notification-swagger-ui", r -> r.path("/notification/swagger-ui/**", "/notification/swagger-ui.html")
                        .filters(f -> f.rewritePath("/notification/(?<segment>.*)", "/${segment}"))
                        .uri("lb://notification-service"))
                .route("notification-openapi", r -> r.path("/notification/v3/api-docs/**")
                        .filters(f -> f.rewritePath("/notification/(?<segment>.*)", "/${segment}"))
                        .uri("lb://notification-service"))
                .build();
    }

    @Bean
    public CorsWebFilter corsWebFilter() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(
                "http://localhost:3000"
        ));
        config.addAllowedMethod("*");
        config.addAllowedHeader("*");
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return new CorsWebFilter(source);
    }
}
