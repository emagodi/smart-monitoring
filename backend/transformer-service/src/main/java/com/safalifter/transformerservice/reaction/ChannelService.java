package com.safalifter.transformerservice.reaction;

import com.safalifter.transformerservice.config.AccessScopeService;
import com.safalifter.transformerservice.config.AuthenticatedUserPrincipal;
import com.safalifter.transformerservice.config.ChatCommandUserProfile;
import com.safalifter.transformerservice.config.RemoteUserService;
import com.safalifter.transformerservice.config.UserAccessProfile;
import com.safalifter.transformerservice.enums.IncidentOutcome;
import com.safalifter.transformerservice.enums.Role;
import com.safalifter.transformerservice.payload.request.response.CloseIncidentRequest;
import com.safalifter.transformerservice.payload.response.AlertResponse;
import com.safalifter.transformerservice.payload.response.response.ResponseBoardResponse;
import com.safalifter.transformerservice.service.ResponseService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.function.Supplier;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The reaction desk over WhatsApp, USSD and (later) the mobile app. The caller is identified by the phone number
 * registered on their user account; every action runs with that user's own permissions and area, and is recorded in
 * the incident timeline exactly like a web action (with "via WhatsApp" / "via USSD").
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ChannelService {

    private final RemoteUserService remoteUserService;
    private final ResponseService responseService;

    private static final Pattern CMD = Pattern.compile("(?is)^\\s*(open|alerts|ack|acknowledge|arrived|onsite|on site|close|false|real|fault|help)\\b\\s*#?(\\d+)?\\s*(.*)$");

    // ------------------------------------------------------------------ text commands (WhatsApp, SMS bots)

    public String handleText(String phone, String text, String channel) {
        Matcher m = CMD.matcher(text == null ? "" : text);
        if (!m.matches()) return help();
        String verb = m.group(1).toLowerCase(Locale.ROOT).replace(" ", "");
        Long id = m.group(2) != null ? Long.valueOf(m.group(2)) : null;
        String rest = m.group(3) == null ? "" : m.group(3).trim();
        if ("help".equals(verb)) return help();
        return asUser(phone, () -> switch (verb) {
            case "open", "alerts" -> openList(5);
            case "ack", "acknowledge" -> id == null ? "Send ACK followed by the alert number, e.g. ACK 1234." : ack(id, rest, channel);
            case "arrived", "onsite" -> id == null ? "Send ARRIVED followed by the alert number, e.g. ARRIVED 1234." : onScene(id, rest, channel);
            case "close" -> {
                if (id == null) yield "Send CLOSE, the alert number and the outcome, e.g. CLOSE 1234 FALSE.";
                String[] parts = rest.split("\\s+", 2);
                IncidentOutcome o = outcome(parts.length > 0 ? parts[0] : "");
                if (o == null) yield "Which outcome? Reply CLOSE " + id + " FALSE, REAL, FAULT or AUTH.";
                yield close(id, o, parts.length > 1 ? parts[1] : null, channel);
            }
            case "false", "real", "fault" -> id == null ? "Send " + verb.toUpperCase(Locale.ROOT) + " followed by the alert number." : close(id, outcome(verb), rest, channel);
            default -> help();
        });
    }

    // ------------------------------------------------------------------ USSD (CON = menu continues, END = session ends)

    /**
     * Stateless menu: the gateway sends the whole input path ("4*1234*1"), as Africa's Talking and most aggregators do.
     */
    public String handleUssd(String phone, String text) {
        String[] in = text == null || text.isBlank() ? new String[0] : text.trim().split("\\*");
        if (in.length == 0) {
            return "CON TAIS reaction desk\n1. Open alerts\n2. Acknowledge alert\n3. Team on site\n4. Close alert";
        }
        String choice = in[0];
        if ("1".equals(choice)) return "END " + asUser(phone, () -> openList(4));
        if (!List.of("2", "3", "4").contains(choice)) return "END Invalid choice.";
        if (in.length == 1) return "CON Enter the alert number:";
        Long id;
        try {
            id = Long.valueOf(in[1].replaceAll("\\D", ""));
        } catch (NumberFormatException e) {
            return "END That is not an alert number.";
        }
        final Long alertId = id;
        if ("2".equals(choice)) return "END " + asUser(phone, () -> ack(alertId, null, "USSD"));
        if ("3".equals(choice)) return "END " + asUser(phone, () -> onScene(alertId, null, "USSD"));
        if (in.length == 2) return "CON Outcome for alert #" + id + ":\n1. False alarm\n2. Real threat\n3. Technical fault\n4. Authorised work";
        IncidentOutcome o = switch (in[2]) {
            case "1" -> IncidentOutcome.FALSE_ALARM;
            case "2" -> IncidentOutcome.REAL_THREAT;
            case "3" -> IncidentOutcome.TECHNICAL_FAULT;
            case "4" -> IncidentOutcome.AUTHORISED_ACTIVITY;
            default -> null;
        };
        if (o == null) return "END Invalid outcome.";
        return "END " + asUser(phone, () -> close(alertId, o, null, "USSD"));
    }

    // ------------------------------------------------------------------ actions

    private String openList(int max) {
        ResponseBoardResponse board = responseService.board();
        List<ResponseBoardResponse.BoardCase> open = board.getOpen() == null ? List.of() : board.getOpen();
        if (open.isEmpty()) return "No open alerts in your area.";
        StringBuilder sb = new StringBuilder("Open alerts (" + open.size() + "):");
        open.stream().limit(max).forEach(c -> {
            AlertResponse a = c.getAlert();
            sb.append("\n#").append(a.getId()).append(" ").append(nz(a.getTransformerName(), "?"))
                    .append(" · ").append(nz(a.getValue(), "alert"))
                    .append(" · ").append(a.getCaseStatus() == null ? "NEW" : a.getCaseStatus().name().replace('_', ' '))
                    .append(" · ").append(ago(a.getCreatedAt()));
        });
        if (open.size() > max) sb.append("\n+").append(open.size() - max).append(" more on the web desk.");
        sb.append("\nReply ACK <number> to acknowledge.");
        return sb.toString();
    }

    private String ack(Long id, String note, String channel) {
        AlertResponse a = responseService.acknowledge(id, via(note, channel, "Acknowledged"));
        return "Alert #" + id + " acknowledged (" + nz(a.getTransformerName(), "") + "). Reply ARRIVED " + id + " when the team is on site.";
    }

    private String onScene(Long id, String note, String channel) {
        AlertResponse a = responseService.markOnScene(id, via(note, channel, "Team on site"));
        return "Alert #" + id + " marked on site (" + nz(a.getTransformerName(), "") + "). Reply CLOSE " + id + " FALSE, REAL, FAULT or AUTH when done.";
    }

    private String close(Long id, IncidentOutcome o, String note, String channel) {
        CloseIncidentRequest r = new CloseIncidentRequest();
        r.setOutcome(o);
        r.setNote(via(note, channel, "Closed"));
        AlertResponse a = responseService.close(id, r);
        return "Alert #" + id + " closed as " + ResponseService.outcomeLabel(o).toLowerCase(Locale.ROOT) + " (" + nz(a.getTransformerName(), "") + "). Thank you.";
    }

    // ------------------------------------------------------------------ identity

    /** Runs the action as the user registered with this phone number; turns errors into a short message. */
    private String asUser(String phone, Supplier<String> action) {
        ChatCommandUserProfile u;
        try {
            u = remoteUserService.resolveChatCommandUser(phone);
        } catch (Exception e) {
            return "This number is not registered on TAIS. Ask your administrator to add it to your user profile.";
        }
        if (u == null || u.getEmail() == null || (u.getStatus() != null && !"ACTIVE".equalsIgnoreCase(u.getStatus()))) {
            return "This number is not linked to an active TAIS user.";
        }
        UserAccessProfile access = null;
        try {
            access = remoteUserService.getAccessByEmail(u.getEmail());
        } catch (Exception ignored) {
            // fall back to the chat profile
        }
        Role role = access != null && access.getRole() != null ? access.getRole() : Role.USER;
        List<SimpleGrantedAuthority> auth = new ArrayList<>(role.getAuthorities());
        java.util.Collection<String> perms = access != null && access.getPermissions() != null ? access.getPermissions() : u.getPermissions();
        if (perms != null) {
            auth.add(new SimpleGrantedAuthority(AccessScopeService.PERMISSIONS_LOADED));
            perms.forEach(p -> auth.add(new SimpleGrantedAuthority(p)));
        }
        AuthenticatedUserPrincipal principal = new AuthenticatedUserPrincipal(u.getEmail(),
                access != null ? access.getUserType() : u.getUserType(),
                access != null ? access.getSupplierId() : null,
                access != null ? access.getSupplierCode() : u.getSupplierCode(),
                access != null ? access.getSupplierName() : u.getSupplierName(),
                access != null ? access.getDepotId() : null,
                auth);
        var previous = SecurityContextHolder.getContext().getAuthentication();
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(principal, null, auth));
        try {
            return action.get();
        } catch (ResponseStatusException e) {
            return nz(e.getReason(), "That could not be done.");
        } catch (Exception e) {
            log.warn("Channel action failed for {}: {}", u.getEmail(), e.getMessage());
            return "That could not be done right now. Please use the web desk.";
        } finally {
            SecurityContextHolder.getContext().setAuthentication(previous);
        }
    }

    private static IncidentOutcome outcome(String s) {
        return switch (s == null ? "" : s.trim().toLowerCase(Locale.ROOT)) {
            case "false", "f", "falsealarm", "false_alarm" -> IncidentOutcome.FALSE_ALARM;
            case "real", "r", "threat", "theft" -> IncidentOutcome.REAL_THREAT;
            case "fault", "technical", "t" -> IncidentOutcome.TECHNICAL_FAULT;
            case "auth", "authorised", "authorized", "work" -> IncidentOutcome.AUTHORISED_ACTIVITY;
            case "other", "o" -> IncidentOutcome.OTHER;
            default -> null;
        };
    }

    private static String via(String note, String channel, String what) {
        String n = note == null || note.isBlank() ? what : note.trim();
        return n + " (via " + nz(channel, "channel") + ")";
    }

    private static String ago(LocalDateTime t) {
        if (t == null) return "";
        long m = Math.max(0, Duration.between(t, LocalDateTime.now()).toMinutes());
        return m < 60 ? m + " min ago" : m < 2880 ? (m / 60) + " h ago" : (m / 1440) + " d ago";
    }

    private static String help() {
        return "TAIS reaction desk: OPEN (open alerts in your area), ACK 1234 (acknowledge), ARRIVED 1234 (team on site), "
                + "CLOSE 1234 FALSE | REAL | FAULT | AUTH (close with the outcome).";
    }

    private static String nz(String s, String d) {
        return s == null || s.isBlank() ? d : s;
    }
}
