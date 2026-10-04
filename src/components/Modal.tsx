// QVAULT — shared Modal (Calm Precision).
// Animasi masuk lewat Web Animations API native (lihat lib/motion) supaya
// konsisten dengan gerak halaman lain dan otomatis dimatikan saat reduced-motion.
import { type ReactNode, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "../lib/utils";
import { fadeIn, motionOK, popIn } from "../lib/motion";
import IconButton from "./ui/IconButton";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Animasi masuk: overlay fade + panel naik halus.
  useEffect(() => {
    if (!open || !motionOK) return;
    fadeIn(overlayRef.current, 0.22);
    popIn(panelRef.current);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onMouseDown={onClose}
    >
      <div ref={overlayRef} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        ref={panelRef}
        className={cn(
          "relative z-10 max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-elevated p-5 shadow-2xl",
          className,
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-base font-semibold tracking-tight text-ink">
                {title}
              </h2>
              {description && (
                <p className="mt-0.5 text-xs text-muted">{description}</p>
              )}
            </div>
            <IconButton icon={X} label="Close" onClick={onClose} />
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
