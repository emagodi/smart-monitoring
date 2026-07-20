package com.safalifter.authservice.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.*;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    @Value("${contracts.drafts.storage-path:uploads/contracts}")
    private String storageDir;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // Expose e.g. /files/contracts/** -> file:uploads/contracts/
        registry.addResourceHandler("/files/contracts/**")
                .addResourceLocations("file:" + storageDir + "/")
                .setCachePeriod(3600);
    }
}

