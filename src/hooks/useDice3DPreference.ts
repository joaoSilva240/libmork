"use client";

import { useSyncExternalStore } from "react";
import { isDice3DEnabled, setDice3DEnabled, subscribeDice3DPreference } from "@/lib/dice3d";

export function useDice3DPreference(): [boolean, (enabled: boolean) => void] {
  const enabled = useSyncExternalStore(subscribeDice3DPreference, isDice3DEnabled, () => true);
  return [enabled, setDice3DEnabled];
}
