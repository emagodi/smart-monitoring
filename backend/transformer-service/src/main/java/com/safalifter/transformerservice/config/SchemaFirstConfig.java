package com.safalifter.transformerservice.config;

import org.springframework.boot.autoconfigure.orm.jpa.EntityManagerFactoryDependsOnPostProcessor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Makes Hibernate (the JPA EntityManagerFactory) wait for {@link SchemaUpgrader}. On the server
 * spring.jpa.hibernate.ddl-auto=validate, so Hibernate refuses to start if a mapped column is missing; with this the
 * additive schema upgrade always runs first and a new build can never fail to start on a not-yet-upgraded database.
 */
@Configuration
public class SchemaFirstConfig {

    @Bean
    public static EntityManagerFactoryDependsOnPostProcessor schemaUpgraderBeforeJpa() {
        return new EntityManagerFactoryDependsOnPostProcessor("schemaUpgrader");
    }
}
