package com.safalifter.authservice.service;

public interface SmsService {
    public boolean sendSms(String phone, String message);
}
