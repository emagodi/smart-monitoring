import { useEffect, useState } from "react";
import { Activity, AlertTriangle, RefreshCcw } from "lucide-react";
import { cachedGet } from "../../lib/cache";

const API = import.meta.env.VITE_API_BASE_URL || "";

type Ingestor = {
  supplier: string;
  enabled: boolean;
  connected?: boolean;
  healthy?: boolean;
  lastUplinkAt?: string | null;
  uplinkIdleSeconds?: number | null;
  lastMessageAt?: string | null;
  messagesByType?: Record<string, number>;
  uplinksStored?: number;
  reconnectCount?: number;
  lastReconnectReason?: string | null;
  lastError?: string | null;
  queueSize?: number;
};
type Status = { ingestors: Ingestor[]; timestamp: string };

const ago = (s?: number | null) => {
  if (s == null) return "never since restart";
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
};

/**
 * Live state of the Oqulus (LORIOT app WebSocket) feed: when the last uplink was stored. If no uplink arrives for
 * 10 minutes the server reconnects on its own; this makes a stall visible on the page instead of every device
 * silently drifting to "offline".
 */
export default function FeedStatus({ token }: { token: string | null | undefined }) {
  const [feed, setFeed] = useState<Ingestor | null>(null);
  const [unreachable, setUnreachable] = useState(false);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    const load = () =>
      cachedGet<Status>(`${API}/api/v1/ws-ingest/status`, token, 20_000, true)
        .then((s) => {
          if (!alive) return;
          setFeed(s?.ingestors?.find((i) => i.supplier === "oculus" && i.enabled) ?? null);
          setUnreachable(false);
        })
        .catch(() => alive && setUnreachable(true));
    load();
    const t = window.setInterval(load, 60_000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [token]);

  if (unreachable) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] text-blue-100/80 ring-1 ring-white/10">
        <Activity className="h-3.5 w-3.5" /> Oqulus feed status unavailable
      </span>
    );
  }
  if (!feed) return null;

  const healthy = !!feed.healthy;
  const detail = [
    `Messages: ${Object.entries(feed.messagesByType ?? {}).map(([k, v]) => `${k} ${v}`).join(", ") || "none"}`,
    `Uplinks stored: ${feed.uplinksStored ?? 0}`,
    `Reconnects: ${feed.reconnectCount ?? 0}${feed.lastReconnectReason ? ` (last: ${feed.lastReconnectReason})` : ""}`,
    feed.lastError ? `Last error: ${feed.lastError}` : null,
    feed.queueSize ? `Waiting to store: ${feed.queueSize}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <span
      title={detail}
      className={`inline-flex flex-wrap items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ring-1 ${
        healthy ? "bg-emerald-400/15 text-emerald-100 ring-emerald-300/30" : "bg-red-500/25 text-red-50 ring-red-300/40"
      }`}
    >
      {healthy ? (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
        </span>
      ) : (
        <AlertTriangle className="h-3.5 w-3.5" />
      )}
      Oqulus feed {healthy ? "live" : feed.connected ? "connected, no uplinks" : "disconnected"} · last uplink {ago(feed.uplinkIdleSeconds)}
      {!healthy && (feed.reconnectCount ?? 0) > 0 ? (
        <span className="inline-flex items-center gap-1 font-normal opacity-90">
          <RefreshCcw className="h-3 w-3" /> reconnecting automatically ({feed.reconnectCount})
        </span>
      ) : null}
    </span>
  );
}
