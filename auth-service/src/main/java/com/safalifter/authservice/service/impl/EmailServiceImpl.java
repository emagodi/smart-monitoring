package com.safalifter.authservice.service.impl;

import lombok.RequiredArgsConstructor;
import microsoft.exchange.webservices.data.core.ExchangeService;
import microsoft.exchange.webservices.data.core.enumeration.misc.ExchangeVersion;
import microsoft.exchange.webservices.data.core.service.item.EmailMessage;
import microsoft.exchange.webservices.data.credential.WebCredentials;
import microsoft.exchange.webservices.data.property.complex.MessageBody;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import com.safalifter.authservice.payload.request.MailBody;
import com.safalifter.authservice.service.EmailService;

import java.net.URI;

@Service
@RequiredArgsConstructor
public class EmailServiceImpl implements EmailService {

    private static final Logger logger = LoggerFactory.getLogger(EmailServiceImpl.class);

    @Value("${ews.username:}")
    private String username;

    @Value("${ews.password:}")
    private String password;

    @Value("${ews.url:}")
    private String ewsUrl;

    public void sendSimpleMessage(MailBody mailBody) {
        try {
            // Create ExchangeService instance
            ExchangeService service = new ExchangeService(ExchangeVersion.Exchange2010_SP2);
            service.setCredentials(new WebCredentials(username, password));
            service.setUrl(new URI(ewsUrl));

            // Create the email message
            EmailMessage message = new EmailMessage(service);
            message.setSubject(mailBody.subject());
            message.setBody(new MessageBody(mailBody.text()));
            message.getToRecipients().add(mailBody.to());

            // Send the email
            message.send();
            logger.info("Email sent to: {}", mailBody.to());
        } catch (Exception e) {
            logger.error("Error while sending email to {}: {}", mailBody.to(), e.getMessage());
        }
    }
}