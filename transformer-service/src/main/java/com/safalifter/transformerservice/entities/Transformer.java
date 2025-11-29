package com.safalifter.transformerservice.entities;

import com.safalifter.transformerservice.handlers.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "transformers")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Transformer extends BaseEntity {
    @Column(nullable = false)
    private String name;
    @Column(nullable = false)
    private Integer capacity;
    @Column(nullable = false)
    private boolean isActive;
    @Column(name = "depot_id", nullable = false)
    private Long depotId;
}