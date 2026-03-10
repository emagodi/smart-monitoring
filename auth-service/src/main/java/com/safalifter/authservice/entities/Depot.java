package com.safalifter.authservice.entities;

import com.safalifter.authservice.handlers.BaseEntity;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "depots")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Depot extends BaseEntity {

    @Column(nullable = false)
    private String name;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "district_id")
    private District district;
}