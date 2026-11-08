import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SceneBar } from "../SceneBar";

describe("SceneBar (issue #86, Fase 1)", () => {
  it("renderiza os 5 botões na ordem da spec", () => {
    render(<SceneBar activeScene={null} onSceneChange={vi.fn()} />);
    const order = ["combat", "interlude", "stealth", "investigation", "escape"];
    for (const value of order) {
      expect(screen.getByTestId(`scene-btn-${value}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId("scene-mode-label").textContent).toBe("Cena: Livre");
  });

  it("marca a cena ativa com aria-pressed e label correto", () => {
    render(<SceneBar activeScene="combat" onSceneChange={vi.fn()} />);
    expect(screen.getByTestId("scene-btn-combat")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("scene-btn-stealth")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("scene-mode-label").textContent).toBe("Cena: Combate");
  });

  it("clicar cena inativa seleciona a cena", () => {
    const onSceneChange = vi.fn();
    render(<SceneBar activeScene={null} onSceneChange={onSceneChange} />);
    fireEvent.click(screen.getByTestId("scene-btn-escape"));
    expect(onSceneChange).toHaveBeenCalledWith("escape");
  });

  it("clicar a cena ativa volta ao Livre", () => {
    const onSceneChange = vi.fn();
    render(<SceneBar activeScene="investigation" onSceneChange={onSceneChange} />);
    fireEvent.click(screen.getByTestId("scene-btn-investigation"));
    expect(onSceneChange).toHaveBeenCalledWith(null);
  });

  it("disabled bloqueia cliques", () => {
    const onSceneChange = vi.fn();
    render(<SceneBar activeScene={null} onSceneChange={onSceneChange} disabled />);
    fireEvent.click(screen.getByTestId("scene-btn-combat"));
    expect(onSceneChange).not.toHaveBeenCalled();
  });
});
