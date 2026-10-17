package com.safalifter.transformerservice.util;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

/**
 * Tiny in-memory cache for read-heavy dashboard queries. Values expire after a fixed time, and
 * concurrent callers asking for the same key while it loads wait for the one computation instead of
 * all hitting the database (no stampede when 50 agents open the dashboard together).
 */
public class TtlCache<V> {

    private record Entry<V>(V value, long expiresAt) {}

    private final long ttlMillis;
    private final int maxEntries;
    private final Map<String, Entry<V>> entries = new ConcurrentHashMap<>();
    private final Map<String, Object> locks = new ConcurrentHashMap<>();

    public TtlCache(long ttlMillis, int maxEntries) {
        this.ttlMillis = ttlMillis;
        this.maxEntries = maxEntries;
    }

    public V get(String key, Supplier<V> loader) {
        long now = System.currentTimeMillis();
        Entry<V> hit = entries.get(key);
        if (hit != null && hit.expiresAt() > now) return hit.value();
        Object lock = locks.computeIfAbsent(key, k -> new Object());
        synchronized (lock) {
            hit = entries.get(key);
            if (hit != null && hit.expiresAt() > System.currentTimeMillis()) return hit.value();
            V value = loader.get();
            if (entries.size() >= maxEntries) entries.clear();
            entries.put(key, new Entry<>(value, System.currentTimeMillis() + ttlMillis));
            return value;
        }
    }

    public void clear() {
        entries.clear();
    }
}
