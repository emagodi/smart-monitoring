package com.safalifter.transformerservice.config;

import com.safalifter.transformerservice.service.CameraIntegrationService;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.integration.annotation.ServiceActivator;
import org.springframework.integration.channel.DirectChannel;
import org.springframework.integration.core.MessageProducer;
import org.springframework.integration.mqtt.core.DefaultMqttPahoClientFactory;
import org.springframework.integration.mqtt.core.MqttPahoClientFactory;
import org.springframework.integration.mqtt.inbound.MqttPahoMessageDrivenChannelAdapter;
import org.springframework.integration.mqtt.support.DefaultPahoMessageConverter;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageHandler;

import org.springframework.integration.config.EnableIntegration;
import org.springframework.context.event.EventListener;
import org.springframework.integration.mqtt.event.MqttConnectionFailedEvent;
import org.springframework.integration.mqtt.event.MqttSubscribedEvent;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Configuration
@EnableIntegration
public class MqttConfig {

    @Bean
    public MqttPahoClientFactory mqttClientFactory() {
        DefaultMqttPahoClientFactory factory = new DefaultMqttPahoClientFactory();
        MqttConnectOptions options = new MqttConnectOptions();
        // Use Mosquitto Public Broker as it is more permissive
        options.setServerURIs(new String[]{"tcp://test.mosquitto.org:1883"});
        options.setCleanSession(true);
        options.setAutomaticReconnect(true);
        factory.setConnectionOptions(options);
        return factory;
    }

    @Bean
    public MessageChannel mqttInputChannel() {
        return new DirectChannel();
    }

    @Bean
    public MessageProducer inbound() {
        // Use a unique client ID to avoid conflicts on the public broker
        String clientId = "transformer-service-" + java.util.UUID.randomUUID().toString().substring(0, 8);
        log.info("Initializing MQTT Adapter with Client ID: {}", clientId);
        MqttPahoMessageDrivenChannelAdapter adapter =
                new MqttPahoMessageDrivenChannelAdapter(clientId, mqttClientFactory(), "safalifter/smart-monitoring/NE101/Snap", "safa/snap");
        adapter.setCompletionTimeout(5000);
        DefaultPahoMessageConverter converter = new DefaultPahoMessageConverter();
        converter.setPayloadAsBytes(true); // Force binary payload for images
        adapter.setConverter(converter);
        adapter.setQos(1);
        adapter.setOutputChannel(mqttInputChannel());
        return adapter;
    }

    @Bean
    @ServiceActivator(inputChannel = "mqttInputChannel")
    public MessageHandler handler(CameraIntegrationService cameraService) {
        return message -> {
            log.info("MQTT Message received in handler: {}", message.getPayload());
            cameraService.processCameraMessage(message);
        };
    }

    @EventListener
    public void handleMqttConnectionFailed(MqttConnectionFailedEvent event) {
        log.error("MQTT Connection Failed: {}", event.getCause().getMessage());
    }

    @EventListener
    public void handleMqttSubscribed(MqttSubscribedEvent event) {
        log.info("MQTT Subscribed to topic: {}", event.getMessage());
    }
}
