package com.safalifter.authservice.service;

import com.safalifter.authservice.payload.request.MailBody;

public interface EmailService {
    public void sendSimpleMessage(MailBody mailBody);
}
