package com.safalifter.authservice.repository;

import com.safalifter.authservice.entities.NotificationDirectoryEntry;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface NotificationDirectoryEntryRepository extends JpaRepository<NotificationDirectoryEntry, Long> {

    @EntityGraph(attributePaths = {"supplier", "notificationTypes"})
    @Query("select distinct e from NotificationDirectoryEntry e left join fetch e.notificationTypes where lower(e.supplier.code) = lower(?1) order by e.channel asc, e.displayName asc")
    List<NotificationDirectoryEntry> findAllBySupplierCode(String supplierCode);
}
