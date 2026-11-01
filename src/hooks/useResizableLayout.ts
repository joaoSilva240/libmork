"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface UseResizableLayoutOptions {
  storageKey?: string;
  initialWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  initialHeight?: number;
  minHeight?: number;
  maxHeight?: number;
}

export interface UseResizableLayoutReturn {
  width: number;
  height: number;
  handleResize: (deltaX: number, deltaY: number) => void;
  reset: () => void;
  setWidth: (w: number) => void;
  setHeight: (h: number) => void;
  reload: () => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function loadFromStorage(key: string | undefined, fallback: number): number {
  if (typeof window === "undefined" || !key) return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    if (stored !== null) {
      const parsed = parseFloat(stored);
      if (!isNaN(parsed)) return parsed;
    }
  } catch {
    // Ignore storage errors
  }
  return fallback;
}

function saveToStorage(key: string | undefined, value: number): void {
  if (typeof window === "undefined" || !key) return;
  try {
    window.localStorage.setItem(key, value.toString());
  } catch {
    // Ignore storage errors
  }
}

export function useResizableLayout({
  storageKey,
  initialWidth = 320,
  minWidth = 200,
  maxWidth = 800,
  initialHeight = 400,
  minHeight = 200,
  maxHeight = 800,
}: UseResizableLayoutOptions = {}): UseResizableLayoutReturn {
  const previousStorageKey = useRef(storageKey);

  const isValidKey = Boolean(storageKey && storageKey.trim() !== "");
  const widthKey = isValidKey ? `${storageKey}-width` : undefined;
  const heightKey = isValidKey ? `${storageKey}-height` : undefined;

  const [width, setWidthState] = useState(() =>
    clamp(loadFromStorage(widthKey, initialWidth), minWidth, maxWidth),
  );
  const [height, setHeightState] = useState(() =>
    clamp(loadFromStorage(heightKey, initialHeight), minHeight, maxHeight),
  );

  const reload = useCallback(() => {
    if (!storageKey || storageKey.trim() === "") return;
    const newWidthKey = `${storageKey}-width`;
    const newHeightKey = `${storageKey}-height`;
    const newWidth = clamp(loadFromStorage(newWidthKey, initialWidth), minWidth, maxWidth);
    const newHeight = clamp(loadFromStorage(newHeightKey, initialHeight), minHeight, maxHeight);
    setWidthState(newWidth);
    setHeightState(newHeight);
  }, [storageKey, initialWidth, initialHeight, minWidth, maxWidth, minHeight, maxHeight]);

  // Re-hydrate when storageKey changes dynamically to a valid key
  useEffect(() => {
    if (storageKey !== previousStorageKey.current) {
      previousStorageKey.current = storageKey;
      if (storageKey && storageKey.trim() !== "") {
        reload();
      }
    }
  }, [storageKey, reload]);

  const setWidth = useCallback(
    (w: number) => {
      const clamped = clamp(w, minWidth, maxWidth);
      setWidthState(clamped);
      saveToStorage(widthKey, clamped);
    },
    [minWidth, maxWidth, widthKey],
  );

  const setHeight = useCallback(
    (h: number) => {
      const clamped = clamp(h, minHeight, maxHeight);
      setHeightState(clamped);
      saveToStorage(heightKey, clamped);
    },
    [minHeight, maxHeight, heightKey],
  );

  const handleResize = useCallback(
    (deltaX: number, deltaY: number) => {
      if (deltaX !== 0) {
        setWidth(width + deltaX);
      }
      if (deltaY !== 0) {
        setHeight(height + deltaY);
      }
    },
    [width, height, setWidth, setHeight],
  );

  const reset = useCallback(() => {
    setWidth(initialWidth);
    setHeight(initialHeight);
  }, [initialWidth, initialHeight, setWidth, setHeight]);

  return {
    width,
    height,
    handleResize,
    reset,
    setWidth,
    setHeight,
    reload,
  };
}
