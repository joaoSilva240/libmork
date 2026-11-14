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

  describe("indicador de combate em 2º plano (Fase 2)", () => {
    it("combatBackgroundActive com cena que não é Combate mostra o indicador", () => {
      render(<SceneBar activeScene="stealth" onSceneChange={vi.fn()} combatBackgroundActive />);
      expect(screen.getByTestId("scene-combat-indicator")).toBeInTheDocument();
    });

    it("combatBackgroundActive na cena Combate não mostra o indicador", () => {
      render(<SceneBar activeScene="combat" onSceneChange={vi.fn()} combatBackgroundActive />);
      expect(screen.queryByTestId("scene-combat-indicator")).toBeNull();
    });

    it("sem combatBackgroundActive (default) não mostra o indicador", () => {
      render(<SceneBar activeScene="interlude" onSceneChange={vi.fn()} />);
      expect(screen.queryByTestId("scene-combat-indicator")).toBeNull();
    });

    it("indicador fica ao lado do label, antes dos botões de cena", () => {
      render(<SceneBar activeScene={null} onSceneChange={vi.fn()} combatBackgroundActive />);
      const bar = screen.getByTestId("scene-bar");
      const indicator = screen.getByTestId("scene-combat-indicator");
      const label = screen.getByTestId("scene-mode-label");
      expect(indicator.parentElement).toBe(bar);
      expect(label.compareDocumentPosition(indicator)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      expect(indicator.compareDocumentPosition(screen.getByTestId("scene-btn-combat"))).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    });
  });
});
