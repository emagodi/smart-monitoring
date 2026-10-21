package com.safalifter.transformerservice.cache;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.ByteArrayOutputStream;
import java.io.EOFException;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;

/**
 * A deliberately small Redis client (RESP2 over a plain socket) with a tiny connection pool and hard timeouts.
 * No extra libraries, so nothing new can break the build; every call either answers within the timeout or
 * throws an IOException that the caller ({@link SharedCache}) turns into "cache miss".
 */
public final class RedisLite {

    private final String host;
    private final int port;
    private final String password;
    private final int database;
    private final int connectTimeoutMs;
    private final int readTimeoutMs;
    private final BlockingQueue<Conn> idle;

    public RedisLite(String host, int port, String password, int database, int connectTimeoutMs, int readTimeoutMs, int poolSize) {
        this.host = host;
        this.port = port;
        this.password = password == null || password.isBlank() ? null : password;
        this.database = database;
        this.connectTimeoutMs = connectTimeoutMs;
        this.readTimeoutMs = readTimeoutMs;
        this.idle = new ArrayBlockingQueue<>(Math.max(1, poolSize));
    }

    // ------------------------------------------------------------------ commands

    public String get(String key) throws IOException {
        Object r = exec("GET", key);
        return r == null ? null : (String) r;
    }

    public void setPx(String key, String value, long ttlMs) throws IOException {
        exec("SET", key, value, "PX", String.valueOf(Math.max(1, ttlMs)));
    }

    public long incr(String key) throws IOException {
        Object r = exec("INCR", key);
        return r instanceof Long l ? l : 0L;
    }

    public void del(String key) throws IOException {
        exec("DEL", key);
    }

    public boolean ping() throws IOException {
        return "PONG".equals(exec("PING"));
    }

    /** INFO section as text (used by the cache status page). */
    public String info(String section) throws IOException {
        Object r = exec("INFO", section);
        return r == null ? "" : r.toString();
    }

    public long dbSize() throws IOException {
        Object r = exec("DBSIZE");
        return r instanceof Long l ? l : 0L;
    }

    // ------------------------------------------------------------------ plumbing

    private Object exec(String... args) throws IOException {
        Conn c = idle.poll();
        boolean pooled = c != null;
        if (c == null) c = open();
        try {
            return callAndRelease(c, args);
        } catch (IOException e) {
            if (!pooled || e.getMessage() != null && e.getMessage().startsWith("Redis error:")) throw e;
            // A pooled connection went stale (Redis restarted / idle timeout): drop them all, retry once on a new one.
            close();
            return callAndRelease(open(), args);
        }
    }

    private Object callAndRelease(Conn c, String... args) throws IOException {
        try {
            Object r = c.call(args);
            if (!idle.offer(c)) c.close();
            return r;
        } catch (IOException e) {
            c.close();
            throw e;
        } catch (RuntimeException e) {
            c.close();
            throw new IOException(e.getMessage(), e);
        }
    }

    private Conn open() throws IOException {
        Socket s = new Socket();
        try {
            s.setTcpNoDelay(true);
            s.setKeepAlive(true);
            s.connect(new InetSocketAddress(host, port), connectTimeoutMs);
            s.setSoTimeout(readTimeoutMs);
            Conn c = new Conn(s);
            if (password != null) c.call("AUTH", password);
            if (database > 0) c.call("SELECT", String.valueOf(database));
            return c;
        } catch (IOException e) {
            try {
                s.close();
            } catch (IOException ignored) {
                // nothing to do
            }
            throw e;
        }
    }

    public void close() {
        Conn c;
        while ((c = idle.poll()) != null) c.close();
    }

    private static final class Conn {
        private final Socket socket;
        private final OutputStream out;
        private final InputStream in;

        Conn(Socket socket) throws IOException {
            this.socket = socket;
            this.out = new BufferedOutputStream(socket.getOutputStream(), 8192);
            this.in = new BufferedInputStream(socket.getInputStream(), 8192);
        }

        Object call(String... args) throws IOException {
            write(args);
            return read();
        }

        private void write(String... args) throws IOException {
            ByteArrayOutputStream b = new ByteArrayOutputStream(64);
            b.write(('*' + Integer.toString(args.length) + "\r\n").getBytes(StandardCharsets.US_ASCII));
            for (String a : args) {
                byte[] bytes = a.getBytes(StandardCharsets.UTF_8);
                b.write(('$' + Integer.toString(bytes.length) + "\r\n").getBytes(StandardCharsets.US_ASCII));
                b.write(bytes);
                b.write('\r');
                b.write('\n');
            }
            b.writeTo(out);
            out.flush();
        }

        private Object read() throws IOException {
            int type = in.read();
            if (type < 0) throw new EOFException("Redis closed the connection");
            String line = readLine();
            switch (type) {
                case '+':
                    return line;
                case '-':
                    throw new IOException("Redis error: " + line);
                case ':':
                    return Long.parseLong(line);
                case '$': {
                    int len = Integer.parseInt(line);
                    if (len < 0) return null;
                    byte[] data = in.readNBytes(len);
                    if (data.length < len) throw new EOFException("Short read from Redis");
                    readLine(); // trailing CRLF
                    return new String(data, StandardCharsets.UTF_8);
                }
                case '*': {
                    int n = Integer.parseInt(line);
                    if (n < 0) return null;
                    java.util.List<Object> items = new java.util.ArrayList<>(n);
                    for (int i = 0; i < n; i++) items.add(read());
                    return items;
                }
                default:
                    throw new IOException("Unexpected Redis reply type: " + (char) type);
            }
        }

        private String readLine() throws IOException {
            StringBuilder sb = new StringBuilder();
            int c;
            while ((c = in.read()) != -1) {
                if (c == '\r') {
                    int n = in.read();
                    if (n == '\n') return sb.toString();
                    sb.append((char) c);
                    if (n == -1) break;
                    sb.append((char) n);
                } else {
                    sb.append((char) c);
                }
            }
            throw new EOFException("Redis closed the connection");
        }

        void close() {
            try {
                socket.close();
            } catch (IOException ignored) {
                // already closed
            }
        }
    }
}
