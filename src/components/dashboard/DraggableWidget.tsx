"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Minus, Maximize2, X, GripHorizontal } from "lucide-react";

interface DraggableWidgetProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  defaultPosition: { x: number; y: number };
  defaultWidth?: number;
  accentColor?: string;
  children: React.ReactNode;
  onClose?: () => void;
  visible?: boolean; // CSS show/hide — preserves drag position
}

export function DraggableWidget({
  title,
  icon,
  defaultPosition,
  defaultWidth = 300,
  accentColor = "#1e3a8a",
  children,
  onClose,
  visible = true,
}: DraggableWidgetProps) {
  const [pos, setPos] = useState(defaultPosition);
  const [minimized, setMinimized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [zIndex, setZIndex] = useState(1500);

  const dragStart = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const bringToFront = useCallback(() => {
    setZIndex((z) => Math.max(z, Date.now() % 5000 + 2000));
  }, []);

  const handleHeaderMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Don't drag when clicking buttons inside the header
      if ((e.target as HTMLElement).closest("button")) return;
      e.preventDefault();
      bringToFront();
      dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
      setIsDragging(true);
    },
    [pos, bringToFront]
  );

  useEffect(() => {
    if (!isDragging) return;

    const onMove = (e: MouseEvent) => {
      if (!dragStart.current) return;
      const dx = e.clientX - dragStart.current.mx;
      const dy = e.clientY - dragStart.current.my;
      setPos({
        x: Math.max(0, dragStart.current.px + dx),
        y: Math.max(0, dragStart.current.py + dy),
      });
    };

    const onUp = () => {
      setIsDragging(false);
      dragStart.current = null;
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDragging]);

  return (
    <div
      ref={panelRef}
      className="fixed select-none"
      style={{
        left: pos.x,
        top: pos.y,
        width: defaultWidth,
        zIndex,
        cursor: isDragging ? "grabbing" : "default",
        // CSS hide/show — widget stays mounted, keeps its drag position
        display: visible ? "block" : "none",
        pointerEvents: visible ? "auto" : "none",
      }}
      onMouseDown={bringToFront}
    >
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.94)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(226,232,240,0.85)",
          boxShadow: isDragging
            ? "0 28px 72px rgba(0,0,0,0.24), 0 4px 16px rgba(0,0,0,0.1)"
            : "0 8px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)",
          transition: isDragging ? "none" : "box-shadow 0.2s ease",
        }}
      >
        {/* Header / drag handle */}
        <div
          className="flex items-center gap-2 px-3 py-2.5 cursor-grab active:cursor-grabbing"
          style={{
            background: `linear-gradient(135deg, ${accentColor}10, ${accentColor}05)`,
            borderBottom: `1px solid ${accentColor}18`,
            userSelect: "none",
          }}
          onMouseDown={handleHeaderMouseDown}
        >
          <GripHorizontal className="w-3 h-3 text-slate-300 flex-shrink-0" />
          <div style={{ color: accentColor }} className="flex-shrink-0">{icon}</div>
          <span className="text-xs font-semibold text-slate-700 flex-1 truncate">{title}</span>

          {/* Controls — stop propagation so clicking doesn't start drag */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setMinimized((m) => !m); }}
              className="w-5 h-5 rounded flex items-center justify-center hover:bg-slate-200 transition-colors"
              title={minimized ? "Expand" : "Minimize"}
            >
              {minimized
                ? <Maximize2 className="w-3 h-3 text-slate-500" />
                : <Minus className="w-3 h-3 text-slate-500" />
              }
            </button>
            {onClose && (
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                className="w-5 h-5 rounded flex items-center justify-center hover:bg-red-100 transition-colors"
                title="Hide panel"
              >
                <X className="w-3 h-3 text-slate-400 hover:text-rose-600" />
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        {!minimized && (
          <div className="overflow-y-auto" style={{ maxHeight: "68vh" }}>
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
