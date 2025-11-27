package com.safalifter.authservice.config;


import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import com.safalifter.authservice.entities.User;
import com.safalifter.authservice.enums.*;


import com.safalifter.authservice.repository.UserRepository;


@Component
@RequiredArgsConstructor
public class DataLoader implements CommandLineRunner {


    private final UserRepository userRepository;

    private final PasswordEncoder passwordEncoder;

   

   

    @Override
    public void run(String... args) throws Exception {
        // Create super admin user
        createSuperAdmin();
        

        // Load 200 requisitions with approvals
         // loadRequisitions();

    }

    private void createSuperAdmin() {
        if (!userRepository.findByEmail("emagodi1@powertel.co.zw").isPresent()) {
            User superAdmin = new User();
            superAdmin.setFirstname("Edwin");
            superAdmin.setLastname("Magodi");
            superAdmin.setEmail("emagodi1@powertel.co.zw");
            superAdmin.setPassword(passwordEncoder.encode("Password@123"));
            superAdmin.setRole(Role.ADMIN);
            superAdmin.setTemporaryPassword(false);

            userRepository.save(superAdmin);
            System.out.println("Default ADMIN user created.");
        } else {
            System.out.println("ADMIN user already exists.");
        }
    }
    
    }


