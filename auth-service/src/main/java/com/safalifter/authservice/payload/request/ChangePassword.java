package com.safalifter.authservice.payload.request;

public record ChangePassword(String password, String repeatPassword) {
}