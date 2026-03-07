package com.safalifter.transformerservice.config;

import com.safalifter.transformerservice.entities.Camera;
import com.safalifter.transformerservice.entities.Controller;
import com.safalifter.transformerservice.entities.Transformer;
import com.safalifter.transformerservice.entities.TransformerType;
import com.safalifter.transformerservice.repository.CameraRepository;
import com.safalifter.transformerservice.repository.ControllerRepository;
import com.safalifter.transformerservice.repository.TransformerRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final TransformerRepository transformerRepository;
    private final ControllerRepository controllerRepository;
    private final CameraRepository cameraRepository;

    @Override
    public void run(String... args) throws Exception {
        if (transformerRepository.count() == 0) {
            log.info("Seeding data for Simulation...");

            Transformer transformer = Transformer.builder()
                    .name("New Parliament")
                    .capacity(500)
                    .isActive(true)
                    .depotId(1L)
                    .type(TransformerType.GROUND_MOUNTED)
                    .lat(new BigDecimal("-17.824858"))
                    .lng(new BigDecimal("31.053028"))
                    .build();
            transformer = transformerRepository.save(transformer);
            log.info("Created Transformer: {}", transformer.getName());

            Controller controller = Controller.builder()
                    .deviceId("dev-simulation-01")
                    .devEui("eui-simulation-01")
                    .name("Simulation Controller")
                    .type("Dragino")
                    .transformerId(transformer.getId())
                    .build();
            controllerRepository.save(controller);
            log.info("Created Controller: {}", controller.getName());

            Camera camera = Camera.builder()
                    .name("Simulation Camera")
                    .topic("camera/simulation")
                    .transformerId(transformer.getId())
                    .status("ACTIVE")
                    .model("Hikvision")
                    .ipAddress("192.168.1.100")
                    .build();
            cameraRepository.save(camera);
            log.info("Created Camera: {}", camera.getName());
        } else {
            log.info("Data already seeded.");
        }
    }
}
