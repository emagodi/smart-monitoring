import type React from "react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface DropdownProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  usePortal?: boolean;
  anchorRect?: DOMRect | null;
  placement?: "right" | "bottom" | "bottom-end";
  offset?: number;
}

export const Dropdown: React.FC<DropdownProps> = ({
  isOpen,
  onClose,
  children,
  className = "",
  usePortal = true,
  anchorRect,
  placement = "right",
  offset = 8,
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !(event.target as HTMLElement).closest(".dropdown-toggle")
      ) {
        onClose();
      }
    };

    const handleDismiss = () => onClose();

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleDismiss, true);
    window.addEventListener("resize", handleDismiss, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleDismiss, true);
      window.removeEventListener("resize", handleDismiss, true);
    };
  }, [onClose]);

  if (!isOpen) return null;

  const content = (
    <div
      ref={dropdownRef}
      className={`rounded-xl border border-gray-200 bg-white shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark ${className}`}
    >
      {children}
    </div>
  );

  if (!usePortal || !anchorRect) {
    return (
      <div className="absolute z-40 right-0 mt-2">
        {content}
      </div>
    );
  }

  const top =
    placement === "bottom" || placement === "bottom-end"
      ? Math.round(anchorRect.bottom + offset)
      : Math.round(anchorRect.top);

  const left =
    placement === "bottom"
      ? Math.round(anchorRect.left)
      : placement === "right"
      ? Math.round(anchorRect.right + offset)
      : undefined;

  const right =
    placement === "bottom-end"
      ? window.innerWidth - anchorRect.right
      : undefined;

  return createPortal(
    <div
      style={{ 
        position: "fixed", 
        top, 
        left: left !== undefined ? left : "auto", 
        right: right !== undefined ? right : "auto",
        zIndex: 1000 
      }}
      className=""
    >
      {content}
    </div>,
    document.body
  );
};
