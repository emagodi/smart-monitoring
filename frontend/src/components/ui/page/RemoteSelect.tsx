import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { Check, ChevronDown, Loader2, MapPinned, Search, X } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";

const API = import.meta.env.VITE_API_BASE_URL || "";
const PAGE = 20;

export type LookupItem = { id: number; name: string; parentId?: number | null; parentName?: string | null; children?: number };

type Props = {
  /** What to pick: regions (for a district) or districts (for a depot). */
  kind: "region" | "district";
  value: string;
  onChange: (id: string, item: LookupItem | null) => void;
  placeholder?: string;
  /** Only districts in this region. */
  regionId?: string | number | null;
  /** Label to show for the current value before it is looked up. */
  initialLabel?: string;
};

/**
 * Searchable picker that loads matches page by page from the server as you type or scroll
 * (GET /api/v1/{regions|districts}/lookup?q=&page=&size=). Works the same with 10 or 10,000 rows.
 */
export default function RemoteSelect({ kind, value, onChange, placeholder, regionId, initialLabel }: Props) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<LookupItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState<LookupItem | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const reqId = useRef(0);
  const plural = kind === "region" ? "regions" : "districts";

  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  // Show the current value's name (and its region) without loading the whole list.
  useEffect(() => {
    if (!value) {
      setSelected(null);
      return;
    }
    if (selected && String(selected.id) === value) return;
    let cancelled = false;
    axios
      .get(`${API}/api/v1/${plural}/lookup/${value}`, { headers })
      .then((r) => !cancelled && setSelected(r.data as LookupItem))
      .catch(() => !cancelled && setSelected({ id: Number(value), name: initialLabel || `#${value}` }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, plural]);

  const load = useCallback(
    async (term: string, p: number) => {
      const id = ++reqId.current;
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(`${API}/api/v1/${plural}/lookup`, {
          headers,
          params: { q: term, page: p, size: PAGE, regionId: kind === "district" && regionId ? regionId : undefined },
        });
        if (id !== reqId.current) return;
        const body = res.data as { items: LookupItem[]; hasMore: boolean };
        setItems((cur) => (p === 0 ? body.items : [...cur, ...body.items]));
        setHasMore(Boolean(body.hasMore));
        setPage(p);
        if (p === 0) setActive(0);
      } catch {
        if (id === reqId.current) setError(`Could not load ${plural}.`);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kind, plural, regionId, token]
  );

  // Debounced search while open.
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => void load(q.trim(), 0), q ? 250 : 0);
    return () => window.clearTimeout(t);
  }, [load, open, q]);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const choose = (item: LookupItem) => {
    setSelected(item);
    onChange(String(item.id), item);
    setOpen(false);
    setQ("");
  };

  const onScroll = () => {
    const el = listRef.current;
    if (!el || loading || !hasMore) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) void load(q.trim(), page + 1);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (items[active]) choose(items[active]);
    } else if (e.key === "Escape") {
      e.stopPropagation();
      setOpen(false);
    }
  };

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex h-12 w-full items-center gap-3 rounded-xl border bg-white px-3.5 text-left transition dark:bg-slate-900 ${
          open ? "border-blue-400 ring-2 ring-blue-100 dark:ring-blue-500/20" : "border-slate-200 hover:border-slate-300 dark:border-slate-700"
        }`}
      >
        <MapPinned className="h-4 w-4 shrink-0 text-blue-600" />
        <span className="min-w-0 flex-1">
          {selected ? (
            <>
              <span className="block truncate text-[15px] font-medium text-slate-900 dark:text-slate-100">{selected.name}</span>
              {selected.parentName ? <span className="block truncate text-[11px] text-slate-500">{selected.parentName}</span> : null}
            </>
          ) : (
            <span className="text-[15px] text-slate-400">{placeholder || `Choose a ${kind}…`}</span>
          )}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <div className="relative border-b border-slate-100 dark:border-slate-800">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKey}
              placeholder={kind === "district" ? "Type a district or region name…" : "Type a region name…"}
              className="h-11 w-full bg-transparent pl-10 pr-9 text-[15px] text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
            />
            {q ? (
              <button type="button" onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="Clear">
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <ul ref={listRef} onScroll={onScroll} className="max-h-64 overflow-y-auto py-1" role="listbox">
            {items.map((it, i) => {
              const isSel = selected && selected.id === it.id;
              return (
                <li key={it.id} data-i={i}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(it)}
                    className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left ${i === active ? "bg-blue-50 dark:bg-slate-800" : ""}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900 dark:text-slate-100">{it.name}</span>
                      <span className="block truncate text-[11px] text-slate-500">
                        {it.parentName ? `${it.parentName} · ` : ""}
                        {it.children ?? 0} {kind === "district" ? "depot" : "district"}
                        {it.children === 1 ? "" : "s"}
                      </span>
                    </span>
                    {isSel ? <Check className="h-4 w-4 text-blue-600" /> : null}
                  </button>
                </li>
              );
            })}
            {loading ? (
              <li className="flex items-center gap-2 px-3.5 py-2.5 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
              </li>
            ) : null}
            {!loading && !error && items.length === 0 ? <li className="px-3.5 py-3 text-sm text-slate-500">No {plural} match “{q}”.</li> : null}
            {error ? <li className="px-3.5 py-3 text-sm text-red-600">{error}</li> : null}
            {!loading && hasMore ? <li className="px-3.5 py-2 text-center text-[11px] text-slate-400">Scroll for more</li> : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
