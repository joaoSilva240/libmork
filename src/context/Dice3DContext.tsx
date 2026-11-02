"use client";

import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import type { DiceRollRequest } from "@/components/dice3d/diceGeometry";

export interface Dice3DContextType {
  isDice3DEnabled: boolean;
  toggleDice3D: (enabled?: boolean) => void;
  rollDice3D: (rolls: Array<{ sides: number; result: number }>) => void;
  activeRolls: DiceRollRequest[];
  clearRolls: () => void;
}

const STORAGE_KEY = "libmork_dice3d_enabled";

const Dice3DContext = createContext<Dice3DContextType | undefined>(undefined);

export function Dice3DProvider({ children }: { children: React.ReactNode }) {
  const [isDice3DEnabled, setIsDice3DEnabled] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored !== null) {
          return stored === "true";
        }
      } catch {}
    }
    return true;
  });
  const [activeRolls, setActiveRolls] = useState<DiceRollRequest[]>([]);
  const clearTimerRef = useRef<NodeJS.Timeout | null>(null);

  const toggleDice3D = useCallback((enabled?: boolean) => {
    setIsDice3DEnabled((prev) => {
      const nextVal = enabled !== undefined ? enabled : !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(nextVal));
      } catch {}
      return nextVal;
    });
  }, []);

  const clearRolls = useCallback(() => {
    if (clearTimerRef.current) {
      clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
    setActiveRolls([]);
  }, []);

  const rollDice3D = useCallback(
    (rolls: Array<{ sides: number; result: number }>) => {
      if (!isDice3DEnabled || rolls.length === 0) return;

      const requests: DiceRollRequest[] = rolls.map((r, idx) => ({
        id: `${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
        sides: r.sides,
        result: r.result,
      }));

      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
      }

      setActiveRolls(requests);

      clearTimerRef.current = setTimeout(() => {
        setActiveRolls([]);
        clearTimerRef.current = null;
      }, 4200);
    },
    [isDice3DEnabled],
  );

  return (
    <Dice3DContext.Provider
      value={{
        isDice3DEnabled,
        toggleDice3D,
        rollDice3D,
        activeRolls,
        clearRolls,
      }}
    >
      {children}
    </Dice3DContext.Provider>
  );
}

export function useDice3D(): Dice3DContextType {
  const context = useContext(Dice3DContext);
  if (!context) {
    // Retorna fallback gracioso caso renderizado fora do provider em testes isolados
    return {
      isDice3DEnabled: true,
      toggleDice3D: () => {},
      rollDice3D: () => {},
      activeRolls: [],
      clearRolls: () => {},
    };
  }
  return context;
}
