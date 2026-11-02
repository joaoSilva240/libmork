import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { PlayerDashboard } from "../PlayerDashboard";
import { Dice3DProvider } from "@/context/Dice3DContext";

vi.mock("@/context/SocketContext", () => ({
  useSocket: () => ({
    joinCampaign: vi.fn(),
    leaveCampaign: vi.fn(),
  }),
}));

describe("PlayerDashboard - Settings Tab & Dice 3D", () => {
  beforeEach(() => {
    localStorage.clear();
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/characters") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }
      if (url === "/api/campaigns") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }
      if (url === "/api/player/wealth") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              characters: [],
              campaigns: [],
              consolidatedVault: { copper: 0, silver: 0, electrum: 0, gold: 0, platinum: 0 },
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  it("permite navegar para a aba de configurações e alternar os dados 3D", async () => {
    render(
      <Dice3DProvider>
        <PlayerDashboard />
      </Dice3DProvider>,
    );

    const settingsTabBtn = screen.getByRole("button", { name: "Configurações" });
    expect(settingsTabBtn).toBeInTheDocument();

    fireEvent.click(settingsTabBtn);

    const toggle = screen.getByTestId("toggle-dice-3d");
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-checked", "true");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(localStorage.getItem("libmork_dice3d_enabled")).toBe("false");
  });
});
