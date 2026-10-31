"use client";

import { useRef, useState, type PointerEvent } from "react";

export interface ResizeHandleProps {
  onResize: (deltaX: number, deltaY: number) => void;
  onResizeEnd?: () => void;
  direction?: "both" | "horizontal" | "vertical";
  className?: string;
  title?: string;
  "data-testid"?: string;
}

export function ResizeHandle({
  onResize,
  onResizeEnd,
  direction = "both",
  className = "",
  title = "Redimensionar",
  "data-testid": testId,
}: ResizeHandleProps) {
  const [isResizing, setIsResizing] = useState(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const pointerId = useRef<number | null>(null);

  const cursor =
    direction === "horizontal"
      ? "cursor-ew-resize"
      : direction === "vertical"
        ? "cursor-ns-resize"
        : "cursor-se-resize";

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    pointerId.current = event.pointerId;
    lastPoint.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsResizing(true);
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (pointerId.current !== event.pointerId || !lastPoint.current) return;

    const deltaX = event.clientX - lastPoint.current.x;
    const deltaY = event.clientY - lastPoint.current.y;
    lastPoint.current = { x: event.clientX, y: event.clientY };
    onResize(
      direction === "vertical" ? 0 : deltaX,
      direction === "horizontal" ? 0 : deltaY,
    );
  };

  const finishResize = (event: PointerEvent<HTMLButtonElement>) => {
    if (pointerId.current !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    pointerId.current = null;
    lastPoint.current = null;
    setIsResizing(false);
    onResizeEnd?.();
  };

  return (
    <button
      type="button"
      aria-label={title}
      title={title}
      data-testid={testId}
      className={`absolute bottom-1 right-1 z-10 touch-none select-none p-1 text-zinc-500 transition-colors hover:text-zinc-200 active:text-purple-400 ${cursor} ${isResizing ? "text-purple-400" : ""} ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishResize}
      onPointerCancel={finishResize}
    >
      <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 16 16" fill="none">
        <path d="M5 11h6M8 14h3M11 8v3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      </svg>
    </button>
  );
}
