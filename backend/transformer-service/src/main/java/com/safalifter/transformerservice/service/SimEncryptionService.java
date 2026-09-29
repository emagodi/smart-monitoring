package com.safalifter.transformerservice.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

@Service
@Slf4j
public class SimEncryptionService {

    private static final int GCM_NONCE_LENGTH = 12;
    private static final int GCM_TAG_LENGTH = 128;
    private static final String CIPHER_ALGO = "AES/GCM/NoPadding";
    private static final String KEY_ALGO = "AES";

    private final SecretKeySpec secretKey;
    private final boolean encryptionConfigured;

    public SimEncryptionService(@Value("${sim.encryption.key:}") String rawKey) {
        byte[] keyBytes;
        if (rawKey == null || rawKey.isBlank()) {
            log.warn("sim.encryption.key is not set! SIM PIN/PUK encryption uses an insecure derived key. Set sim.encryption.key to a strong 32-byte base64 or raw string.");
            keyBytes = deriveInsecureKey();
            this.encryptionConfigured = false;
        } else {
            this.encryptionConfigured = true;
            try {
                byte[] decoded = Base64.getDecoder().decode(rawKey.trim());
                if (decoded.length >= 16) {
                    keyBytes = decoded;
                } else {
                    keyBytes = sha256(rawKey.trim());
                }
            } catch (Exception e) {
                keyBytes = sha256(rawKey.trim());
            }
        }
        byte[] trimmed = new byte[32];
        System.arraycopy(keyBytes, 0, trimmed, 0, Math.min(keyBytes.length, 32));
        this.secretKey = new SecretKeySpec(trimmed, KEY_ALGO);
    }

    public boolean isEncryptionKeyConfigured() {
        return encryptionConfigured;
    }

    public void requireEncryptionKeyForWrite() {
        if (!encryptionConfigured) {
            throw new IllegalStateException("Cannot save SIM with sensitive data: sim.encryption.key is not configured.");
        }
    }

    public String encrypt(String plaintext) {
        if (plaintext == null || plaintext.isBlank()) {
            return null;
        }
        try {
            byte[] nonce = new byte[GCM_NONCE_LENGTH];
            new SecureRandom().nextBytes(nonce);
            Cipher cipher = Cipher.getInstance(CIPHER_ALGO);
            cipher.init(Cipher.ENCRYPT_MODE, secretKey, new GCMParameterSpec(GCM_TAG_LENGTH, nonce));
            byte[] cipherText = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            byte[] combined = new byte[GCM_NONCE_LENGTH + cipherText.length];
            System.arraycopy(nonce, 0, combined, 0, GCM_NONCE_LENGTH);
            System.arraycopy(cipherText, 0, combined, GCM_NONCE_LENGTH, cipherText.length);
            return Base64.getEncoder().encodeToString(combined);
        } catch (Exception e) {
            throw new RuntimeException("Failed to encrypt SIM sensitive value", e);
        }
    }

    public String decrypt(String base64CipherText) {
        if (base64CipherText == null || base64CipherText.isBlank()) {
            return null;
        }
        try {
            byte[] combined = Base64.getDecoder().decode(base64CipherText);
            if (combined.length < GCM_NONCE_LENGTH + 1) {
                throw new IllegalArgumentException("Invalid encrypted value too short");
            }
            byte[] nonce = new byte[GCM_NONCE_LENGTH];
            System.arraycopy(combined, 0, nonce, 0, GCM_NONCE_LENGTH);
            byte[] cipherText = new byte[combined.length - GCM_NONCE_LENGTH];
            System.arraycopy(combined, GCM_NONCE_LENGTH, cipherText, 0, cipherText.length);
            Cipher cipher = Cipher.getInstance(CIPHER_ALGO);
            cipher.init(Cipher.DECRYPT_MODE, secretKey, new GCMParameterSpec(GCM_TAG_LENGTH, nonce));
            return new String(cipher.doFinal(cipherText), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new RuntimeException("Failed to decrypt SIM sensitive value", e);
        }
    }

    public String mask(String value, int keepLast) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.length() <= keepLast) {
            return "*".repeat(trimmed.length());
        }
        return "*".repeat(trimmed.length() - keepLast) + trimmed.substring(trimmed.length() - keepLast);
    }

    private byte[] deriveInsecureKey() {
        return sha256("smart-monitoring-sim-insecure-default-key-2025");
    }

    private static byte[] sha256(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return md.digest(input.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
