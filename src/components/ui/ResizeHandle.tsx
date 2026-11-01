"use client";

import { useRef, useState, type PointerEvent } from "react";

export type ResizeHandlePosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface ResizeHandleProps {
  onResize: (deltaX: number, deltaY: number) => void;
  onResizeEnd?: () => void;
  direction?: "both" | "horizontal" | "vertical";
  position?: ResizeHandlePosition;
  className?: string;
  title?: string;
  "data-testid"?: string;
}

export function ResizeHandle({
  onResize,
  onResizeEnd,
  direction = "both",
  position = "bottom-right",
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

  const positionClass =
    position === "top-left"
      ? "top-1 left-1"
      : position === "top-right"
        ? "top-1 right-1"
        : position === "bottom-left"
          ? "bottom-1 left-1"
          : "bottom-1 right-1";

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

  const svgRotation =
    position === "top-left"
      ? "rotate-180"
      : position === "bottom-left"
        ? "rotate-90"
        : position === "top-right"
          ? "rotate-270"
          : "";

  return (
    <button
      type="button"
      aria-label={title}
      title={title}
      data-testid={testId}
      className={`absolute z-10 touch-none select-none p-1 text-zinc-500 transition-colors hover:text-zinc-200 active:text-purple-400 ${cursor} ${isResizing ? "text-purple-400" : ""} ${positionClass} ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishResize}
      onPointerCancel={finishResize}
    >
      <svg aria-hidden="true" className={`h-4 w-4 ${svgRotation}`} viewBox="0 0 16 16" fill="none">
        <path d="M5 11h6M8 14h3M11 8v3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      </svg>
    </button>
  );
}
