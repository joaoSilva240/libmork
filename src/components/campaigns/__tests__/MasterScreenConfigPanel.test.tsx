import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MasterScreenConfigPanel } from "../MasterScreenConfigPanel";
import {
  useMasterScreenConfig,
  masterScreenConfigKey,
} from "@/hooks/useMasterScreenConfig";
import type { MasterScreenConfig } from "@/hooks/useMasterScreenConfig";

describe("MasterScreenConfigPanel Component", () => {
  const defaultConfig: MasterScreenConfig = {
    showRoster: true,
    showSessionLog: true,
    showCanvas: true,
    showMap: true,
    showJukebox: true,
    showDiceRolls: true,
    showCharactersNpcs: true,
    showPlayers: true,
  };

  it("renders all eight toggles and reset button", () => {
    render(
      <MasterScreenConfigPanel
        config={defaultConfig}
        onUpdate={vi.fn()}
        onReset={vi.fn()}
      />
    );

    expect(screen.getByText("Visibilidade do Escudo")).toBeInTheDocument();
    expect(screen.getByText("Carrossel de Personagens")).toBeInTheDocument();
    expect(screen.getByText("Rolagens da Mesa")).toBeInTheDocument();
    expect(screen.getByText("Canvas Infinito")).toBeInTheDocument();
    expect(screen.getByText("Mapa Tático")).toBeInTheDocument();
    expect(screen.getByText("Jukebox de Áudio")).toBeInTheDocument();
    expect(screen.getByText("Personagens e NPCs")).toBeInTheDocument();
    expect(screen.getByText("Jogadores Conectados")).toBeInTheDocument();
    expect(screen.getByText("Log da Sessão")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restaurar Padrão" })).toBeInTheDocument();

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(8);
    checkboxes.forEach((cb) => {
      expect(cb).toBeChecked();
    });
  });

  it("calls onUpdate with toggled flag when each checkbox is clicked", () => {
    const handleUpdate = vi.fn();
    render(
      <MasterScreenConfigPanel
        config={defaultConfig}
        onUpdate={handleUpdate}
        onReset={vi.fn()}
      />
    );

    const checkboxes = screen.getAllByRole("checkbox");

    fireEvent.click(checkboxes[0]); // showRoster
    expect(handleUpdate).toHaveBeenCalledWith({ showRoster: false });

    fireEvent.click(checkboxes[1]); // showDiceRolls
    expect(handleUpdate).toHaveBeenCalledWith({ showDiceRolls: false });

    fireEvent.click(checkboxes[2]); // showCanvas
    expect(handleUpdate).toHaveBeenCalledWith({ showCanvas: false });

    fireEvent.click(checkboxes[3]); // showMap
    expect(handleUpdate).toHaveBeenCalledWith({ showMap: false });

    fireEvent.click(checkboxes[4]); // showJukebox
    expect(handleUpdate).toHaveBeenCalledWith({ showJukebox: false });

    fireEvent.click(checkboxes[5]); // showCharactersNpcs
    expect(handleUpdate).toHaveBeenCalledWith({ showCharactersNpcs: false });

    fireEvent.click(checkboxes[6]); // showPlayers
    expect(handleUpdate).toHaveBeenCalledWith({ showPlayers: false });

    fireEvent.click(checkboxes[7]); // showSessionLog
    expect(handleUpdate).toHaveBeenCalledWith({ showSessionLog: false });
  });

  it("reflects unchecked state when flags are false", () => {
    const offConfig: MasterScreenConfig = {
      showRoster: false,
      showSessionLog: false,
      showCanvas: false,
      showMap: false,
      showJukebox: false,
      showDiceRolls: false,
      showCharactersNpcs: false,
      showPlayers: false,
    };

    render(
      <MasterScreenConfigPanel
        config={offConfig}
        onUpdate={vi.fn()}
        onReset={vi.fn()}
      />
    );

    const checkboxes = screen.getAllByRole("checkbox");
    checkboxes.forEach((cb) => {
      expect(cb).not.toBeChecked();
    });
  });

  it("calls onReset when 'Restaurar Padrão' button is clicked", () => {
    const handleReset = vi.fn();
    render(
      <MasterScreenConfigPanel
        config={{
          showRoster: false,
          showSessionLog: false,
          showCanvas: false,
          showMap: false,
          showJukebox: false,
          showDiceRolls: false,
          showCharactersNpcs: false,
          showPlayers: false,
        }}
        onUpdate={vi.fn()}
        onReset={handleReset}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Restaurar Padrão" }));
    expect(handleReset).toHaveBeenCalledTimes(1);
  });
});

describe("MasterScreenConfigPanel + useMasterScreenConfig Integration", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders panel with hook defaults then persists toggle change globally", () => {
    function TestWrapper() {
      const { config, updateConfig, resetConfig } = useMasterScreenConfig();
      return (
        <MasterScreenConfigPanel
          config={config}
          onUpdate={updateConfig}
          onReset={resetConfig}
        />
      );
    }

    render(<TestWrapper />);

    // All checked by default
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes[0]).toBeChecked(); // showRoster

    // Toggle roster off
    fireEvent.click(checkboxes[0]);
    expect(checkboxes[0]).not.toBeChecked();

    // Verify persisted globally
    const stored = JSON.parse(localStorage.getItem(masterScreenConfigKey)!);
    expect(stored.showRoster).toBe(false);
    expect(stored.showSessionLog).toBe(true);
  });

  it("restores defaults via reset button after changes", () => {
    function TestWrapper() {
      const { config, updateConfig, resetConfig } = useMasterScreenConfig();
      return (
        <MasterScreenConfigPanel
          config={config}
          onUpdate={updateConfig}
          onReset={resetConfig}
        />
      );
    }

    render(<TestWrapper />);

    // Toggle checkboxes
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    fireEvent.click(checkboxes[2]);
    fireEvent.click(checkboxes[3]);

    // Reset
    fireEvent.click(screen.getByRole("button", { name: "Restaurar Padrão" }));

    // All should be checked again
    const checkboxesAfter = screen.getAllByRole("checkbox");
    checkboxesAfter.forEach((cb) => expect(cb).toBeChecked());
  });
});
