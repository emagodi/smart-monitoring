package com.safalifter.transformerservice;

import com.safalifter.transformerservice.integration.loriot.LoriotProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.context.annotation.Bean;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

@SpringBootApplication
@EnableFeignClients
@EnableDiscoveryClient
@EnableConfigurationProperties(LoriotProperties.class)
@EnableScheduling
@EnableAsync
public class TransformerServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(TransformerServiceApplication.class, args);
    }

    @Bean
    public RestTemplate restTemplate() {
        // Hard timeouts: without them one stuck outside call (e.g. LORIOT) can hang the gateway sync forever.
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10_000);
        factory.setReadTimeout(45_000);
        return new RestTemplate(factory);
    }
}