package com.safalifter.transformerservice.ingest;

import com.safalifter.transformerservice.entities.Controller;
import com.safalifter.transformerservice.repository.ControllerReadingRepository;
import com.safalifter.transformerservice.repository.ControllerRepository;
import com.safalifter.transformerservice.repository.SensorReadingRepository;
import com.safalifter.transformerservice.repository.SensorRepository;
import com.safalifter.transformerservice.service.ControllerReadingService;
import com.safalifter.transformerservice.service.SensorReadingService;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class OculusWebSocketIngestorDuplicateReadingsTest {

    @Test
    void persistsOnlyGwMessageAfterFix() throws Exception {
        SensorRepository sensorRepository = mock(SensorRepository.class);
        SensorReadingRepository sensorReadingRepository = mock(SensorReadingRepository.class);
        SensorReadingService sensorReadingService = mock(SensorReadingService.class);
        ControllerRepository controllerRepository = mock(ControllerRepository.class);
        ControllerReadingRepository controllerReadingRepository = mock(ControllerReadingRepository.class);
        ControllerReadingService controllerReadingService = mock(ControllerReadingService.class);

        when(controllerRepository.findByDevEuiAndSupplierCode(anyString(), eq("oculus"))).thenReturn(Optional.empty());
        when(controllerRepository.save(any())).thenAnswer(invocation -> {
            Controller controller = invocation.getArgument(0);
            controller.setId(10L);
            return controller;
        });

        OculusWebSocketIngestor ingestor = new OculusWebSocketIngestor(
                sensorRepository,
                sensorReadingRepository,
                sensorReadingService,
                controllerRepository,
                controllerReadingRepository,
                controllerReadingService
        );

        String gwPayload = "{\"cmd\":\"gw\",\"seqno\":1467530,\"EUI\":\"A840416BA65E1793\",\"ts\":1772934502463,\"fcnt\":3293,\"port\":2,\"freq\":867500000,\"toa\":1483,\"dr\":\"SF12 BW125 4/5\",\"ack\":false,\"gws\":[{\"rssi\":-105,\"snr\":-18,\"ts\":1772934502463,\"time\":\"2026-03-08T01:48:22.463Z\",\"gweui\":\"24E124FDFEF8EDB2\",\"ant\":0,\"lat\":46.8076885,\"lon\":7.100528}],\"bat\":254,\"offline\":false,\"confirmed\":false,\"devaddr\":\"01FA3364\",\"data\":\"0000000000000000b4ff41\"}";
        String rxPayload = "{\"cmd\":\"rx\",\"seqno\":1467530,\"EUI\":\"A840416BA65E1793\",\"ts\":1772934502463,\"fcnt\":3293,\"port\":2,\"freq\":867500000,\"rssi\":-105,\"snr\":-18,\"toa\":1483,\"dr\":\"SF12 BW125 4/5\",\"ack\":false,\"bat\":254,\"offline\":false,\"confirmed\":false,\"devaddr\":\"01FA3364\",\"data\":\"0000000000000000b4ff41\"}";

        Method method = OculusWebSocketIngestor.class.getDeclaredMethod("processMessage", String.class);
        method.setAccessible(true);
        method.invoke(ingestor, gwPayload);
        method.invoke(ingestor, rxPayload);

        verify(controllerReadingService, times(1)).save(any());
    }
}
