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
  };

  it("renders all four toggles and reset button", () => {
    render(
      <MasterScreenConfigPanel
        config={defaultConfig}
        onUpdate={vi.fn()}
        onReset={vi.fn()}
      />
    );

    expect(screen.getByText("Visibilidade do Escudo")).toBeInTheDocument();
    expect(screen.getByText("Carrossel de Personagens")).toBeInTheDocument();
    expect(screen.getByText("Log da Sessão")).toBeInTheDocument();
    expect(screen.getByText("Canvas Infinito")).toBeInTheDocument();
    expect(screen.getByText("Mapa Tático")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restaurar Padrão" })).toBeInTheDocument();

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(4);
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

    fireEvent.click(checkboxes[1]); // showSessionLog
    expect(handleUpdate).toHaveBeenCalledWith({ showSessionLog: false });

    fireEvent.click(checkboxes[2]); // showCanvas
    expect(handleUpdate).toHaveBeenCalledWith({ showCanvas: false });

    fireEvent.click(checkboxes[3]); // showMap
    expect(handleUpdate).toHaveBeenCalledWith({ showMap: false });
  });

  it("reflects unchecked state when flags are false", () => {
    const offConfig: MasterScreenConfig = {
      showRoster: false,
      showSessionLog: false,
      showCanvas: false,
      showMap: false,
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
        config={{ showRoster: false, showSessionLog: false, showCanvas: false, showMap: false }}
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

    // Toggle all off
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    fireEvent.click(checkboxes[2]);
    fireEvent.click(checkboxes[3]);

    checkboxes.forEach((cb) => expect(cb).not.toBeChecked());

    // Reset
    fireEvent.click(screen.getByRole("button", { name: "Restaurar Padrão" }));

    // All should be checked again
    const checkboxesAfter = screen.getAllByRole("checkbox");
    checkboxesAfter.forEach((cb) => expect(cb).toBeChecked());
  });
});
