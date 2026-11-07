import { useEffect, useRef, useState } from "react";
import { Eraser, PenLine } from "lucide-react";

/** Finger / stylus / mouse signature. Produces a transparent PNG data URL (kept small for storage). */
export function SignaturePad({ value, onChange, disabled }: { value?: string | null; onChange: (dataUrl: string | null) => void; disabled?: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [dirty, setDirty] = useState(false);

  // Draw the saved signature when opening an existing form.
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, c.width, c.height);
      img.src = value;
    }
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value === null]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = ref.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    e.preventDefault();
    ref.current?.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = pos(e);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || disabled) return;
    const ctx = ref.current?.getContext("2d");
    if (!ctx || !last.current) return;
    const p = pos(e);
    ctx.strokeStyle = "#0b1f4d";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    setDirty(true);
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    if (ref.current && dirty) onChange(ref.current.toDataURL("image/png"));
  };
  const clear = () => {
    const c = ref.current;
    c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    setDirty(false);
    onChange(null);
  };

  return (
    <div className="relative">
      <canvas
        ref={ref}
        width={600}
        height={200}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        className={`h-28 w-full touch-none rounded-xl border-2 border-dashed bg-white ${disabled ? "cursor-not-allowed border-slate-200 opacity-80" : "cursor-crosshair border-slate-300 hover:border-blue-400"} dark:bg-slate-50`}
        aria-label="Signature pad"
      />
      {!value && !dirty && !disabled ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center gap-1.5 text-xs text-slate-400">
          <PenLine className="h-3.5 w-3.5" /> Sign here
        </span>
      ) : null}
      {!disabled && (value || dirty) ? (
        <button type="button" onClick={clear} className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[11px] font-semibold text-slate-600 shadow ring-1 ring-slate-200 hover:text-red-600">
          <Eraser className="h-3 w-3" /> Clear
        </button>
      ) : null}
    </div>
  );
}
