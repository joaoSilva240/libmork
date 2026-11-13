import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const roll = vi.fn(() => Promise.resolve([]));
const clearDice = vi.fn();
const initialize = vi.fn(() => Promise.resolve());
const updateConfig = vi.fn(() => Promise.resolve());
const ctor = vi.fn();

vi.mock("@3d-dice/dice-box-threejs", () => ({
  default: class {
    constructor(...args: unknown[]) {
      ctor(...args);
    }
    initialize = initialize;
    roll = roll;
    clearDice = clearDice;
    updateConfig = updateConfig;
  },
}));

import Dice3DLayer from "../Dice3DLayer";
import { Dice3DSettingsPanel } from "../Dice3DSettingsPanel";
import { ThemeProvider } from "@/context/ThemeContext";
import { showDice3D } from "@/lib/dice3d";

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

describe("Dice3DLayer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("não carrega a biblioteca antes da primeira rolagem", () => {
    render(
      <ThemeProvider>
        <Dice3DLayer />
      </ThemeProvider>,
    );
    expect(ctor).not.toHaveBeenCalled();
    expect(screen.getByTestId("dice3d-layer")).toHaveAttribute("data-visible", "false");
  });

  it("rola com o valor sorteado e some 3s após o resultado", async () => {
    render(
      <ThemeProvider>
        <Dice3DLayer />
      </ThemeProvider>,
    );
    await act(async () => {
      showDice3D([{ sides: 20, value: 17 }]);
      await vi.dynamicImportSettled();
      await flush();
    });
    expect(ctor).toHaveBeenCalledWith(
      "#libmork-dice3d",
      expect.objectContaining({
        sounds: false,
        theme_customColorset: expect.objectContaining({ texture: "none" }),
      }),
    );
    expect(roll).toHaveBeenCalledWith("1d20@17");
    expect(screen.getByTestId("dice3d-layer")).toHaveAttribute("data-visible", "true");

    await act(async () => {
      vi.advanceTimersByTime(2999);
    });
    expect(clearDice).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(clearDice).toHaveBeenCalled();
    expect(screen.getByTestId("dice3d-layer")).toHaveAttribute("data-visible", "false");
  });

  it("não rola quando desligado nas configurações", async () => {
    render(
      <ThemeProvider>
        <Dice3DSettingsPanel />
        <Dice3DLayer />
      </ThemeProvider>,
    );
    const toggle = screen.getByRole("switch", { name: "Dados 3D" });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "false");
    await act(async () => {
      showDice3D([{ sides: 6, value: 2 }]);
      await flush();
    });
    expect(roll).not.toHaveBeenCalled();
  });
});
