"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  DEFAULT_MOTION_PREFERENCES,
  getMotionPreferences,
  getSystemReducedMotion,
  resolveMotion,
  subscribeMotionPreferences,
  subscribeSystemReducedMotion,
  type MotionPreferences,
  type ResolvedMotion,
} from "@/lib/motion";

export function useMotionPreferences(): MotionPreferences {
  return useSyncExternalStore(
    subscribeMotionPreferences,
    getMotionPreferences,
    () => DEFAULT_MOTION_PREFERENCES,
  );
}

export function useSystemReducedMotion(): boolean {
  return useSyncExternalStore(subscribeSystemReducedMotion, getSystemReducedMotion, () => false);
}

export function useResolvedMotion(): ResolvedMotion {
  const prefs = useMotionPreferences();
  const systemReduced = useSystemReducedMotion();
  return useMemo(() => resolveMotion(prefs, systemReduced), [prefs, systemReduced]);
}
