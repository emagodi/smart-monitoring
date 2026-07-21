import { useRef, useEffect } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
  children: React.ReactNode;
  showCloseButton?: boolean;
  isFullscreen?: boolean;
  overlayClassName?: string;
  backdropBlur?: boolean;
  title?: string;
  variant?: "center" | "drawer" | "side-panel" | "fullscreen";
  closeOnOverlayClick?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  className,
  showCloseButton = true,
  isFullscreen = false,
  overlayClassName,
  backdropBlur = true,
  title,
  variant = "center",
  closeOnOverlayClick = true,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const resolvedVariant = isFullscreen ? "fullscreen" : variant;

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const wrapperClasses =
    resolvedVariant === "fullscreen"
      ? "fixed inset-0 z-99999 flex items-stretch justify-stretch overflow-y-auto"
      : resolvedVariant === "drawer" || resolvedVariant === "side-panel"
        ? "fixed inset-0 z-99999 flex items-stretch justify-end"
        : "fixed inset-0 z-99999 flex items-center justify-center overflow-y-auto p-4 sm:p-6";

  const overlayClasses =
    resolvedVariant === "fullscreen"
      ? ""
      : `fixed inset-0 h-full w-full bg-slate-950/45 ${
          backdropBlur ? "backdrop-blur-sm" : ""
        } ${overlayClassName || ""}`;

  const contentClasses =
    resolvedVariant === "fullscreen"
      ? "relative min-h-full w-full bg-white dark:bg-gray-950"
      : resolvedVariant === "drawer"
        ? "relative ml-auto flex h-full w-full max-w-2xl flex-col overflow-hidden rounded-none border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-gray-900 sm:rounded-l-[32px]"
        : resolvedVariant === "side-panel"
          ? "relative ml-auto flex h-full w-full max-w-xl flex-col overflow-hidden rounded-none border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-gray-900 sm:rounded-l-[28px]"
          : "relative w-full rounded-3xl bg-white dark:bg-gray-900";

  return (
    <div className={wrapperClasses}>
      {resolvedVariant !== "fullscreen" && (
        <div
          className={overlayClasses}
          onClick={closeOnOverlayClick ? onClose : undefined}
        />
      )}
      <div
        ref={modalRef}
        className={`${contentClasses} ${className || ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        {showCloseButton && (
          <button
            onClick={onClose}
            className="absolute right-3 top-3 z-999 flex h-9.5 w-9.5 items-center justify-center rounded-full bg-gray-100 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white sm:right-5 sm:top-5 sm:h-10 sm:w-10"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M6.04289 16.5413C5.65237 16.9318 5.65237 17.565 6.04289 17.9555C6.43342 18.346 7.06658 18.346 7.45711 17.9555L11.9987 13.4139L16.5408 17.956C16.9313 18.3466 17.5645 18.3466 17.955 17.956C18.3455 17.5655 18.3455 16.9323 17.955 16.5418L13.4129 11.9997L17.955 7.4576C18.3455 7.06707 18.3455 6.43391 17.955 6.04338C17.5645 5.65286 16.9313 5.65286 16.5408 6.04338L11.9987 10.5855L7.45711 6.0439C7.06658 5.65338 6.43342 5.65338 6.04289 6.0439C5.65237 6.43442 5.65237 7.06759 6.04289 7.45811L10.5845 11.9997L6.04289 16.5413Z"
                fill="currentColor"
              />
            </svg>
          </button>
        )}
        <div className={`flex min-h-0 flex-col ${resolvedVariant === "fullscreen" ? "h-full" : "flex-1"}`}>
          <div className={`flex min-h-0 flex-col flex-1 ${title ? "p-4" : ""}`}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
