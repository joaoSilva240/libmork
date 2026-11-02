import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";
import { Dice3DProvider, useDice3D } from "@/context/Dice3DContext";

describe("Dice3DContext & Provider", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  it("inicia ativado por padrão", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Dice3DProvider>{children}</Dice3DProvider>
    );
    const { result } = renderHook(() => useDice3D(), { wrapper });

    expect(result.current.isDice3DEnabled).toBe(true);
    expect(result.current.activeRolls).toEqual([]);
  });

  it("permite alternar ativação e salva no localStorage", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Dice3DProvider>{children}</Dice3DProvider>
    );
    const { result } = renderHook(() => useDice3D(), { wrapper });

    act(() => {
      result.current.toggleDice3D(false);
    });

    expect(result.current.isDice3DEnabled).toBe(false);
    expect(localStorage.getItem("libmork_dice3d_enabled")).toBe("false");

    act(() => {
      result.current.toggleDice3D(true);
    });

    expect(result.current.isDice3DEnabled).toBe(true);
    expect(localStorage.getItem("libmork_dice3d_enabled")).toBe("true");
  });

  it("executa rollDice3D e limpa após o tempo configurado (4.2s)", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Dice3DProvider>{children}</Dice3DProvider>
    );
    const { result } = renderHook(() => useDice3D(), { wrapper });

    act(() => {
      result.current.rollDice3D([{ sides: 20, result: 18 }]);
    });

    expect(result.current.activeRolls.length).toBe(1);
    expect(result.current.activeRolls[0].sides).toBe(20);
    expect(result.current.activeRolls[0].result).toBe(18);

    act(() => {
      vi.advanceTimersByTime(4200);
    });

    expect(result.current.activeRolls).toEqual([]);
  });

  it("não adiciona rolls se desativado", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Dice3DProvider>{children}</Dice3DProvider>
    );
    const { result } = renderHook(() => useDice3D(), { wrapper });

    act(() => {
      result.current.toggleDice3D(false);
    });

    act(() => {
      result.current.rollDice3D([{ sides: 6, result: 4 }]);
    });

    expect(result.current.activeRolls).toEqual([]);
  });
});
