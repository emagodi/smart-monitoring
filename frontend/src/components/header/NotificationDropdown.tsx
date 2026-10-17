import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, Bell, CheckCircle2, Info, Radio, Siren, Truck, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useCachedGet } from "../../lib/cache";
import { timeAgo } from "../ui/page";

const API = import.meta.env.VITE_API_BASE_URL || "";

/**
 * The bell. A real feed from GET /api/v1/alerts/notifications, which the server already filters to
 * what this user may see: alerts in their scope (partner / depot / national), response activity for
 * people on the response desk, and system notices (devices waiting to be linked) for registry admins.
 * "Unread" = newer than the last time this user opened the bell (kept per user in this browser).
 */
type Kind = "ALERT" | "RESPONSE" | "SYSTEM";
type Severity = "critical" | "warning" | "info" | "success";
export type NotificationItem = { id: string; kind: Kind; severity: Severity; title: string; body?: string; at: string; link?: string };

const SEV: Record<Severity, { ring: string; dot: string }> = {
  critical: { ring: "bg-red-50 text-red-600 ring-red-100 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/20", dot: "bg-red-500" },
  warning: { ring: "bg-amber-50 text-amber-600 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20", dot: "bg-amber-500" },
  info: { ring: "bg-blue-50 text-blue-600 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/20", dot: "bg-blue-500" },
  success: { ring: "bg-emerald-50 text-emerald-600 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20", dot: "bg-emerald-500" },
};

const iconFor = (n: NotificationItem) => {
  if (n.kind === "RESPONSE") return n.severity === "success" ? <CheckCircle2 className="h-4 w-4" /> : <Truck className="h-4 w-4" />;
  if (n.kind === "SYSTEM") return <Radio className="h-4 w-4" />;
  if (n.severity === "critical") return <Siren className="h-4 w-4" />;
  if (n.severity === "warning") return <AlertTriangle className="h-4 w-4" />;
  return <Info className="h-4 w-4" />;
};

const ms = (iso?: string) => {
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isNaN(t) ? 0 : t;
};

type Filter = "all" | "ALERT" | "RESPONSE";

export default function NotificationDropdown() {
  const { token, user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const box = useRef<HTMLDivElement>(null);

  const feed = useCachedGet<NotificationItem[]>(token ? `${API}/api/v1/alerts/notifications` : null, token, { maxAgeMs: 15_000, refreshMs: 30_000 });
  const items = useMemo(() => (Array.isArray(feed.data) ? feed.data : []), [feed.data]);

  const seenKey = `notif.seen.${(user as { email?: string } | null)?.email || "me"}`;
  const [seenAt, setSeenAt] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(seenKey)) || 0;
    } catch {
      return 0;
    }
  });
  const unread = items.filter((n) => ms(n.at) > seenAt).length;

  const markSeen = () => {
    const newest = Math.max(Date.now(), ...items.map((n) => ms(n.at)));
    setSeenAt(newest);
    try {
      localStorage.setItem(seenKey, String(newest));
    } catch {
      /* storage unavailable: unread resets on reload */
    }
  };

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => {
    if (!open) void feed.reload();
    else markSeen();
    setOpen(!open);
  };

  const hasResponse = items.some((n) => n.kind === "RESPONSE");
  const shown = filter === "all" ? items : items.filter((n) => n.kind === filter);
  const viewAll = hasPermission("response.read") ? "/response" : hasPermission("alerts.read") ? "/alerts" : "/dashboard";

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        aria-label={unread ? `${unread} new notifications` : "Notifications"}
        className="enterprise-chip relative flex h-10 w-10 items-center justify-center text-slate-500 transition-colors hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-300"
        onClick={toggle}
      >
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 z-10 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white shadow-lg shadow-red-500/30">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
            <span className="relative">{unread > 99 ? "99+" : unread}</span>
          </span>
        ) : null}
        <Bell className="h-5 w-5" />
      </button>

      {open ? (
        <div className="absolute right-0 z-[999] mt-3 flex max-h-[min(560px,80vh)] w-[min(380px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900">
          <div className="bg-gradient-to-br from-slate-950 via-[#0a2a6b] to-[#0b4fc4] px-4 pb-3 pt-3.5 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Notifications</p>
                <p className="text-[11px] text-blue-100/80">{unread ? `${unread} new since you last looked` : "You're up to date"}</p>
              </div>
              <button type="button" onClick={() => { markSeen(); setOpen(false); }} className="rounded-full p-1.5 text-blue-100 hover:bg-white/10" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            {hasResponse ? (
              <div className="mt-2.5 inline-flex gap-1 rounded-full bg-white/10 p-0.5 ring-1 ring-white/15">
                {(["all", "ALERT", "RESPONSE"] as Filter[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${filter === f ? "bg-white text-blue-800" : "text-blue-100 hover:bg-white/10"}`}
                  >
                    {f === "all" ? "All" : f === "ALERT" ? "Alerts" : "Response"}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
            {feed.loading && !feed.data ? (
              Array.from({ length: 4 }).map((_, i) => (
                <li key={i} className="flex gap-3 px-4 py-3">
                  <span className="h-9 w-9 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
                  <span className="flex-1 space-y-2 py-1">
                    <span className="block h-3 w-3/4 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                    <span className="block h-2.5 w-1/2 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                  </span>
                </li>
              ))
            ) : feed.error && !items.length ? (
              <li className="px-4 py-8 text-center text-sm text-slate-500">Could not load notifications.</li>
            ) : !shown.length ? (
              <li className="px-4 py-10 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400" />
                <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">Nothing new</p>
                <p className="text-xs text-slate-500">Alerts and updates for your area will show here.</p>
              </li>
            ) : (
              shown.map((n) => {
                const isNew = ms(n.at) > seenAt;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => {
                        markSeen();
                        setOpen(false);
                        if (n.link) navigate(n.link);
                      }}
                      className={`flex w-full gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60 ${isNew ? "bg-blue-50/50 dark:bg-blue-500/5" : ""}`}
                    >
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 ${SEV[n.severity]?.ring ?? SEV.info.ring}`}>{iconFor(n)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className="line-clamp-2 text-[13px] font-semibold leading-snug text-slate-800 dark:text-slate-100">{n.title}</span>
                          {isNew ? <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${SEV[n.severity]?.dot ?? SEV.info.dot}`} /> : null}
                        </span>
                        {n.body ? <span className="mt-0.5 line-clamp-2 block text-xs text-slate-500 dark:text-slate-400">{n.body}</span> : null}
                        <span className="mt-1 block text-[11px] text-slate-400">{timeAgo(n.at)}</span>
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-4 py-2.5 dark:border-slate-800">
            <button type="button" onClick={markSeen} disabled={!unread} className="text-xs font-semibold text-slate-500 hover:text-blue-600 disabled:opacity-40 dark:text-slate-400">
              Mark all as read
            </button>
            <Link to={viewAll} onClick={() => { markSeen(); setOpen(false); }} className="rounded-full bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">
              View all
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
