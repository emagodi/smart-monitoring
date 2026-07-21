import type React from "react";
import { useRef, useState, useLayoutEffect } from "react";
import { MoreHorizontal } from "lucide-react";
import { Dropdown } from "./Dropdown";
import { DropdownItem } from "./DropdownItem";

interface ExtraItem {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  className?: string;
}

interface ActionMenuProps {
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  extras?: ExtraItem[];
  buttonClassName?: string;
  placement?: "right" | "bottom" | "bottom-end";
}

export const ActionMenu: React.FC<ActionMenuProps> = ({
  onView,
  onEdit,
  onDelete,
  extras,
  buttonClassName = "",
  placement = "right",
}) => {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const idRef = useRef<string>(() => Math.random().toString(36).slice(2)) as React.MutableRefObject<string>;

  const close = () => setOpen(false);

  useLayoutEffect(() => {
    if (open && btnRef.current) {
      setRect(btnRef.current.getBoundingClientRect());
    }
  }, [open]);

  // Ensure only one menu open at a time
  useLayoutEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail !== idRef.current && open) setOpen(false);
    };
    window.addEventListener(OPEN_EVENT, handler as EventListener);
    return () => window.removeEventListener(OPEN_EVENT, handler as EventListener);
  }, [open]);

  return (
    <div className="relative inline-block text-left">
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => {
            const next = !v;
            if (next) window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: idRef.current }));
            return next;
          });
        }}
        className={`dropdown-toggle inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-white/[0.04] dark:hover:text-slate-200 ${buttonClassName}`}
      >
        <MoreHorizontal className="h-4.5 w-4.5" />
      </button>

      <Dropdown isOpen={open} onClose={close} usePortal anchorRect={rect} placement={placement}>
        <div className="py-2">
          {onView && (
            <DropdownItem onClick={onView} onItemClick={close}>
              <span className="inline-flex items-center gap-2">
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 3.333C5.833 3.333 2.5 7.5 2.5 10s3.333 6.667 7.5 6.667S17.5 12.5 17.5 10 14.167 3.333 10 3.333zm0 10A3.333 3.333 0 1010 6.667a3.333 3.333 0 000 6.666z" />
                </svg>
                View
              </span>
            </DropdownItem>
          )}
          {onEdit && (
            <DropdownItem onClick={onEdit} onItemClick={close}>
              <span className="inline-flex items-center gap-2">
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13.75 2.917a1.25 1.25 0 011.768 0l1.565 1.565a1.25 1.25 0 010 1.768l-8.2 8.2a1.667 1.667 0 01-.82.45l-3.274.655a.417.417 0 01-.496-.496l.655-3.274a1.667 1.667 0 01.449-.82l8.183-8.183z" />
                </svg>
                Edit
              </span>
            </DropdownItem>
          )}
          {onDelete && (
            <DropdownItem onClick={onDelete} onItemClick={close} className="text-red-600 hover:text-red-700">
              <span className="inline-flex items-center gap-2">
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M7.5 3.333h5a.833.833 0 01.833.834v.833h2.5a.833.833 0 110 1.667H4.167a.833.833 0 110-1.667h2.5v-.833c0-.461.373-.834.833-.834zM6.667 7.5h6.666l-.584 7.917a1.667 1.667 0 01-1.66 1.55H8.91a1.667 1.667 0 01-1.66-1.55L6.667 7.5z" />
                </svg>
                Delete
              </span>
            </DropdownItem>
          )}
          {extras && extras.map((x, idx) => (
            <DropdownItem key={idx} onClick={x.onClick} onItemClick={close} className={x.className || ""}>
              <span className="inline-flex items-center gap-2">
                {x.icon}
                {x.label}
              </span>
            </DropdownItem>
          ))}
        </div>
      </Dropdown>
    </div>
  );
};

export default ActionMenu;

const OPEN_EVENT = "actionmenu:open";
