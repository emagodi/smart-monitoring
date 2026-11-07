package com.safalifter.transformerservice.reaction;

import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

import static org.springframework.http.HttpStatus.FORBIDDEN;

/** Loss Control duty roster (JWT) and the WhatsApp / USSD channel bridges (channel key + registered phone). */
@RestController
@RequiredArgsConstructor
public class ReactionController {

    private final DutyService dutyService;
    private final ChannelService channelService;

    @Value("${channel.bridge-key:${chat.command.bridge-key:}}")
    private String channelKey;

    // ---- duty roster

    @GetMapping("/api/v1/duty")
    @Operation(summary = "Roster for a depot (or all depots of a region): who is on duty and how they are paged")
    public Map<String, Object> roster(@RequestParam(required = false) String depotIds, @RequestParam(required = false) Long regionId) {
        return dutyService.roster(ids(depotIds), regionId);
    }

    @PutMapping("/api/v1/duty")
    @Operation(summary = "Tick who is on duty for these depots (Loss Control admin)")
    public Map<String, Object> update(@RequestBody DutyService.Update body, @RequestParam(required = false) Long regionId) {
        return dutyService.update(body, regionId);
    }

    @GetMapping("/api/v1/duty/me")
    @Operation(summary = "Am I on duty (drives the alert siren)?")
    public Map<String, Object> me() {
        return dutyService.me();
    }

    @GetMapping("/api/v1/duty/coverage")
    @Operation(summary = "Depot id -> number of people on duty")
    public Map<Long, Long> coverage() {
        return dutyService.coverage();
    }

    // ---- channels (no JWT: guarded by the channel key; the caller is the user registered with that phone number)

    @PostMapping("/api/v1/channels/whatsapp")
    @Operation(summary = "WhatsApp / SMS text command: OPEN, ACK 1234, ARRIVED 1234, CLOSE 1234 FALSE|REAL|FAULT|AUTH. Body {phone, text}")
    public Map<String, Object> whatsapp(@RequestHeader(name = "X-Channel-Key", required = false) String key,
                                        @RequestHeader(name = "X-Chat-Bridge-Key", required = false) String legacyKey,
                                        @RequestBody Map<String, String> body) {
        check(key != null ? key : legacyKey, null);
        String reply = channelService.handleText(body.get("phone"), body.get("text"), body.getOrDefault("channel", "WhatsApp"));
        return Map.of("reply", reply);
    }

    /**
     * USSD gateway callback. Accepts form or JSON fields sessionId, phoneNumber, serviceCode, text (Africa's Talking
     * style: text is the whole input path, e.g. "4*1234*1"). Replies plain text starting with CON (continue) or END.
     * The key may be sent as X-Channel-Key header or ?key= when the gateway cannot add headers.
     */
    @PostMapping(value = "/api/v1/channels/ussd", consumes = {MediaType.APPLICATION_FORM_URLENCODED_VALUE, MediaType.MULTIPART_FORM_DATA_VALUE}, produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> ussdForm(@RequestHeader(name = "X-Channel-Key", required = false) String key,
                                           @RequestParam(name = "key", required = false) String queryKey,
                                           @RequestParam(required = false) String phoneNumber,
                                           @RequestParam(required = false) String text) {
        check(key, queryKey);
        return ResponseEntity.ok().contentType(MediaType.TEXT_PLAIN).body(channelService.handleUssd(phoneNumber, text));
    }

    @PostMapping(value = "/api/v1/channels/ussd", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> ussdJson(@RequestHeader(name = "X-Channel-Key", required = false) String key,
                                           @RequestParam(name = "key", required = false) String queryKey,
                                           @RequestBody Map<String, String> body) {
        check(key, queryKey);
        return ResponseEntity.ok().contentType(MediaType.TEXT_PLAIN)
                .body(channelService.handleUssd(body.getOrDefault("phoneNumber", body.get("msisdn")), body.get("text")));
    }

    private void check(String key, String queryKey) {
        String k = key != null ? key : queryKey;
        if (channelKey == null || channelKey.isBlank() || !channelKey.equals(k)) {
            throw new ResponseStatusException(FORBIDDEN, "Invalid channel key");
        }
    }

    private static List<Long> ids(String csv) {
        if (csv == null || csv.isBlank()) return List.of();
        return Arrays.stream(csv.split(",")).map(String::trim).filter(s -> s.matches("\\d+")).map(Long::valueOf).toList();
    }
}
