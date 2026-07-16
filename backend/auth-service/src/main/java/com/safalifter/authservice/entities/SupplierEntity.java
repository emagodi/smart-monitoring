package com.safalifter.authservice.entities;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "suppliers")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SupplierEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String code;

    @Column(nullable = false, unique = true)
    private String name;

    private String description;

    @Builder.Default
    private String status = "ACTIVE";
}
