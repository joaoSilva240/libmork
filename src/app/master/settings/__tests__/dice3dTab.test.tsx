import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import MasterSettingsPage from "../page";
import { Dice3DProvider } from "@/context/Dice3DContext";

vi.mock("@/components/theme/ThemeConfigPanel", () => ({
  ThemeConfigPanel: () => <div data-testid="mock-theme-panel">Theme Panel</div>,
}));

vi.mock("@/components/campaigns/MasterScreenConfigPanel", () => ({
  MasterScreenConfigPanel: () => <div>Screen Config</div>,
}));

vi.mock("@/components/campaigns/MasterScreenPreview", () => ({
  MasterScreenPreview: () => <div>Screen Preview</div>,
}));

describe("MasterSettingsPage - Dados 3D tab", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renderiza a aba de Dados 3D e permite alternar a opção", () => {
    render(
      <Dice3DProvider>
        <MasterSettingsPage />
      </Dice3DProvider>,
    );

    const dice3dTab = screen.getByRole("tab", { name: /dados 3d/i });
    expect(dice3dTab).toBeInTheDocument();

    fireEvent.click(dice3dTab);

    const toggle = screen.getByTestId("toggle-master-dice-3d");
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-checked", "true");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(localStorage.getItem("libmork_dice3d_enabled")).toBe("false");
  });
});
