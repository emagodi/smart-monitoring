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

    /** Optional second level in Redis (see SharedCache); null = memory only. */
    private final String sharedNamespace;
    private final com.fasterxml.jackson.databind.JavaType sharedType;

    public TtlCache(long ttlMillis, int maxEntries) {
        this(ttlMillis, maxEntries, null, null);
    }

    private TtlCache(long ttlMillis, int maxEntries, String sharedNamespace, com.fasterxml.jackson.databind.JavaType sharedType) {
        this.ttlMillis = ttlMillis;
        this.maxEntries = maxEntries;
        this.sharedNamespace = sharedNamespace;
        this.sharedType = sharedType;
    }

    /**
     * Memory cache backed by Redis: a miss here is first looked up in Redis (filled by an earlier request, another
     * instance or before a restart) and only then computed. Without Redis it behaves exactly like the plain cache.
     */
    public static <V> TtlCache<V> shared(long ttlMillis, int maxEntries, String namespace, com.fasterxml.jackson.core.type.TypeReference<V> type) {
        return new TtlCache<>(ttlMillis, maxEntries, namespace,
                com.fasterxml.jackson.databind.type.TypeFactory.defaultInstance().constructType(type));
    }

    /** The loader wrapped with the Redis level (when configured and reachable). */
    private Supplier<V> through(String key, Supplier<V> loader) {
        if (sharedNamespace == null) return loader;
        return () -> {
            com.safalifter.transformerservice.cache.SharedCache shared = com.safalifter.transformerservice.cache.SharedCache.get();
            if (shared == null) return loader.get();
            return shared.getOrLoad(sharedNamespace, key, sharedType, ttlMillis, loader);
        };
    }

    public V get(String key, Supplier<V> loader) {
        long now = System.currentTimeMillis();
        Entry<V> hit = entries.get(key);
        if (hit != null && hit.expiresAt() > now) return hit.value();
        Object lock = locks.computeIfAbsent(key, k -> new Object());
        synchronized (lock) {
            hit = entries.get(key);
            if (hit != null && hit.expiresAt() > System.currentTimeMillis()) return hit.value();
            V value = through(key, loader).get();
            if (entries.size() >= maxEntries) entries.clear();
            entries.put(key, new Entry<>(value, System.currentTimeMillis() + ttlMillis));
            return value;
        }
    }

    /**
     * Stale-while-revalidate: a fresh value is returned as is; an expired one younger than {@code maxStaleMillis}
     * is returned immediately while ONE background refresh runs (via {@code refresher}); only a missing or very old
     * value makes the caller wait. Keeps list pages instant even when the underlying query takes a while.
     */
    public V getSwr(String key, Supplier<V> loader, long maxStaleMillis, java.util.function.Consumer<Runnable> refresher) {
        long now = System.currentTimeMillis();
        Entry<V> hit = entries.get(key);
        if (hit != null && hit.expiresAt() > now) return hit.value();
        if (hit != null && hit.expiresAt() + maxStaleMillis > now) {
            if (refreshing.add(key)) {
                try {
                    refresher.accept(() -> {
                        try {
                            V value = through(key, loader).get();
                            entries.put(key, new Entry<>(value, System.currentTimeMillis() + ttlMillis));
                        } finally {
                            refreshing.remove(key);
                        }
                    });
                } catch (RuntimeException e) {
                    refreshing.remove(key);
                }
            }
            return hit.value();
        }
        return get(key, loader);
    }

    private final java.util.Set<String> refreshing = ConcurrentHashMap.newKeySet();

    public void clear() {
        entries.clear();
        if (sharedNamespace != null) {
            com.safalifter.transformerservice.cache.SharedCache shared = com.safalifter.transformerservice.cache.SharedCache.get();
            if (shared != null) shared.invalidate(sharedNamespace);
        }
    }
}
