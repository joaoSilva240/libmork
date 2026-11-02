"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type DiceBox from "@3d-dice/dice-box-threejs";
import { useTheme } from "@/context/ThemeContext";
import { useDice3DPreference } from "@/hooks/useDice3DPreference";
import {
  DICE3D_HIDE_DELAY_MS,
  buildDice3DColorset,
  buildDice3DNotation,
  subscribeDice3DRolls,
} from "@/lib/dice3d";

const CONTAINER_ID = "libmork-dice3d";

/**
 * Área transparente (sem fundo e sem capturar cliques) onde os dados 3D rolam.
 * A biblioteca 3D só é baixada/instanciada na primeira rolagem.
 */
export default function Dice3DLayer() {
  const { theme } = useTheme();
  const [enabled] = useDice3DPreference();
  const [visible, setVisible] = useState(false);
  const boxRef = useRef<DiceBox | null>(null);
  const initRef = useRef<Promise<DiceBox> | null>(null);
  const appliedColorsetRef = useRef<string | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const rollIdRef = useRef(0);
  const colorset = useMemo(() => buildDice3DColorset(theme), [theme]);
  const colorsetRef = useRef(colorset);

  useEffect(() => {
    colorsetRef.current = colorset;
  }, [colorset]);

  const getBox = useCallback(() => {
    if (boxRef.current) return Promise.resolve(boxRef.current);
    if (!initRef.current) {
      initRef.current = (async () => {
        const { default: DiceBoxClass } = await import("@3d-dice/dice-box-threejs");
        const box = new DiceBoxClass(`#${CONTAINER_ID}`, {
          sounds: false,
          shadows: true,
          theme_customColorset: colorsetRef.current,
          baseScale: 90,
          strength: 1.2,
        });
        await box.initialize();
        appliedColorsetRef.current = colorsetRef.current.name;
        boxRef.current = box;
        return box;
      })().catch((error: unknown) => {
        initRef.current = null;
        throw error;
      });
    }
    return initRef.current;
  }, []);

  const clearHideTimer = () => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (!enabled) {
      rollIdRef.current += 1;
      clearHideTimer();
      boxRef.current?.clearDice();
      return;
    }
    return subscribeDice3DRolls(async (dice) => {
      const notation = buildDice3DNotation(dice);
      if (!notation) return;
      const rollId = ++rollIdRef.current;
      clearHideTimer();
      try {
        const box = await getBox();
        if (rollId !== rollIdRef.current) return;
        const nextColorset = colorsetRef.current;
        if (appliedColorsetRef.current !== nextColorset.name) {
          await box.updateConfig({ theme_customColorset: nextColorset });
          appliedColorsetRef.current = nextColorset.name;
          if (rollId !== rollIdRef.current) return;
        }
        setVisible(true);
        await box.roll(notation);
        if (rollId !== rollIdRef.current) return;
        hideTimerRef.current = window.setTimeout(() => {
          hideTimerRef.current = null;
          box.clearDice();
          setVisible(false);
        }, DICE3D_HIDE_DELAY_MS);
      } catch (error) {
        console.warn("[dice3d] falha ao rolar dados 3D", error);
        setVisible(false);
      }
    });
  }, [enabled, getBox]);

  useEffect(() => clearHideTimer, []);

  const shown = enabled && visible;

  return (
    <div
      id={CONTAINER_ID}
      aria-hidden="true"
      data-testid="dice3d-layer"
      data-visible={shown ? "true" : "false"}
      className="fixed inset-0 z-[9999] pointer-events-none"
      style={{ visibility: shown ? "visible" : "hidden" }}
    />
  );
}
