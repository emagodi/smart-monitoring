package com.safalifter.transformerservice.cache;

import com.fasterxml.jackson.databind.JavaType;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Supplier;

/**
 * Second-level cache in Redis, shared by restarts (and by more than one transformer-service if you ever scale out).
 *
 * Safety rules, so Redis can never take the system down:
 * - Off unless REDIS_HOST is set. With it off, everything works exactly as before (in-memory caches only).
 * - Every Redis call has a short timeout (300 ms connect / 500 ms read).
 * - Any Redis error is treated as a cache miss, and Redis is then skipped for 30 s (circuit breaker), so a dead
 *   Redis costs nothing; it is retried automatically and picked up again when it is back.
 * - Values are plain JSON of our own response types; anything that fails to (de)serialise is simply not cached.
 * - Invalidation uses a generation number per namespace (INCR), so "clear" is one tiny command, no key scans.
 */
@Component
@Slf4j
public class SharedCache {

    private static volatile SharedCache instance;

    /** For plain (non-Spring) helpers such as {@code TtlCache}. Null until Spring has started this bean. */
    public static SharedCache get() {
        return instance;
    }

    private final ObjectMapper objectMapper;

    @Value("${redis.host:${REDIS_HOST:}}")
    private String host;
    @Value("${redis.port:${REDIS_PORT:6379}}")
    private int port;
    @Value("${redis.password:${REDIS_PASSWORD:}}")
    private String password;
    @Value("${redis.database:${REDIS_DATABASE:0}}")
    private int database;
    @Value("${redis.key-prefix:${REDIS_KEY_PREFIX:tms}}")
    private String prefix;
    @Value("${redis.enabled:${REDIS_ENABLED:true}}")
    private boolean enabledFlag;

    private RedisLite redis;
    private volatile long downUntil = 0;
    private volatile boolean wasDown = false;
    private final AtomicLong hits = new AtomicLong();
    private final AtomicLong misses = new AtomicLong();
    private final AtomicLong writes = new AtomicLong();
    private final AtomicLong errors = new AtomicLong();
    private volatile String lastError;
    private final Map<String, long[]> generationMemo = new ConcurrentHashMap<>();

    public SharedCache(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    void start() {
        if (enabledFlag && host != null && !host.isBlank()) {
            redis = new RedisLite(host.trim(), port, password, database, 300, 500, 16);
            try {
                redis.ping();
                log.info("Redis cache connected at {}:{} (prefix '{}')", host, port, prefix);
            } catch (IOException e) {
                markDown(e);
                log.warn("Redis at {}:{} is not reachable yet ({}); running on in-memory caches and retrying every 30 s", host, port, e.getMessage());
            }
        } else {
            log.info("Redis cache off (REDIS_HOST not set): using in-memory caches only");
        }
        instance = this;
    }

    @PreDestroy
    void stop() {
        if (redis != null) redis.close();
    }

    /** Redis configured and not in its 30 s back-off after an error. */
    public boolean available() {
        return redis != null && System.currentTimeMillis() >= downUntil;
    }

    public ObjectMapper mapper() {
        return objectMapper;
    }

    // ------------------------------------------------------------------ typed get-or-load

    /** Read-through: Redis hit -> value; otherwise load, store in Redis for ttlMs, return. Never throws for Redis. */
    public <T> T getOrLoad(String namespace, String key, JavaType type, long ttlMs, Supplier<T> loader) {
        if (!available()) return loader.get();
        String rk = redisKey(namespace, key);
        T cached = read(rk, type);
        if (cached != null) return cached;
        T value = loader.get();
        write(rk, value, ttlMs);
        return value;
    }

    public <T> T read(String namespace, String key, JavaType type) {
        if (!available()) return null;
        return read(redisKey(namespace, key), type);
    }

    public void write(String namespace, String key, Object value, long ttlMs) {
        if (!available()) return;
        write(redisKey(namespace, key), value, ttlMs);
    }

    /** Drop everything cached under a namespace (all scopes / users) in one INCR. */
    public void invalidate(String namespace) {
        generationMemo.remove(namespace);
        if (!available()) return;
        try {
            redis.incr(prefix + ":gen:" + namespace);
        } catch (IOException e) {
            markDown(e);
        }
    }

    // ------------------------------------------------------------------ internals

    private String redisKey(String namespace, String key) {
        return prefix + ":" + namespace + ":" + generation(namespace) + ":" + key;
    }

    /** Current generation of a namespace, remembered for 1 s to avoid an extra round trip on every read. */
    private long generation(String namespace) {
        long now = System.currentTimeMillis();
        long[] memo = generationMemo.get(namespace);
        if (memo != null && memo[1] > now) return memo[0];
        long gen = 0;
        try {
            String v = redis.get(prefix + ":gen:" + namespace);
            gen = v == null ? 0 : Long.parseLong(v.trim());
        } catch (IOException e) {
            markDown(e);
        } catch (NumberFormatException ignored) {
            gen = 0;
        }
        generationMemo.put(namespace, new long[]{gen, now + 1000});
        return gen;
    }

    private <T> T read(String rk, JavaType type) {
        try {
            String json = redis.get(rk);
            if (json == null) {
                misses.incrementAndGet();
                return null;
            }
            T v = objectMapper.readValue(json, type);
            hits.incrementAndGet();
            recovered();
            return v;
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            misses.incrementAndGet();
            return null; // unreadable entry (e.g. type changed in a new build): just reload it
        } catch (IOException e) {
            markDown(e);
            return null;
        }
    }

    private void write(String rk, Object value, long ttlMs) {
        if (value == null) return;
        try {
            String json = objectMapper.writeValueAsString(value);
            if (json.length() > 8_000_000) return; // never push huge blobs
            redis.setPx(rk, json, ttlMs);
            writes.incrementAndGet();
            recovered();
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            log.debug("Not caching {}: {}", rk, e.getMessage());
        } catch (IOException e) {
            markDown(e);
        }
    }

    private void markDown(Exception e) {
        errors.incrementAndGet();
        lastError = e.getMessage();
        downUntil = System.currentTimeMillis() + 30_000;
        if (!wasDown) {
            wasDown = true;
            log.warn("Redis cache unavailable ({}); using in-memory caches, will retry in 30 s", e.getMessage());
        }
    }

    private void recovered() {
        if (wasDown) {
            wasDown = false;
            log.info("Redis cache is back");
        }
    }

    // ------------------------------------------------------------------ status (admin page / troubleshooting)

    public Map<String, Object> status() {
        Map<String, Object> s = new LinkedHashMap<>();
        boolean configured = redis != null;
        s.put("configured", configured);
        s.put("host", configured ? host + ":" + port : null);
        boolean up = false;
        if (configured) {
            try {
                up = redis.ping();
                if (up) {
                    recovered();
                    downUntil = 0;
                    s.put("keys", redis.dbSize());
                    String mem = redis.info("memory");
                    for (String line : mem.split("\r?\n")) {
                        if (line.startsWith("used_memory_human:") || line.startsWith("maxmemory_human:") || line.startsWith("maxmemory_policy:")) {
                            String[] kv = line.split(":", 2);
                            s.put(kv[0], kv[1].trim());
                        }
                    }
                }
            } catch (IOException e) {
                markDown(e);
            }
        }
        s.put("up", up);
        s.put("hits", hits.get());
        s.put("misses", misses.get());
        s.put("writes", writes.get());
        s.put("errors", errors.get());
        long total = hits.get() + misses.get();
        s.put("hitRatePercent", total == 0 ? null : Math.round(hits.get() * 1000.0 / total) / 10.0);
        s.put("lastError", lastError);
        return s;
    }
}
