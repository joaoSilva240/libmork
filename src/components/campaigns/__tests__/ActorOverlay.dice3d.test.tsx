import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ActorOverlay, type RosterActor } from "../ActorOverlay";

const mockRollDice = vi.fn();
vi.mock("@/context/SocketContext", () => ({
  useSocket: () => ({
    rollDice: mockRollDice,
    updateActorStatus: vi.fn(),
    updateCombatState: vi.fn(),
    requestDefenseReaction: vi.fn(),
    isConnected: true,
  }),
}));

describe("ActorOverlay 3D Dice Emission (Issue #74)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/content/")) {
        return Promise.resolve({
          ok: true,
          json: async () => [],
        });
      }
      if (url.includes("/npcs/") || url.includes("/actors/")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: {
              attributes: { forca: 10, destreza: 12, vigor: 10, inteligencia: 8, empatia: 8 },
              pins: [
                {
                  id: "pin-1",
                  pinType: "attack",
                  label: "Ataque Rápido",
                  rollExpression: "1d20+2",
                },
              ],
              level: 1,
              xpReward: 10,
              hitPoints: 10,
              hitPointsMax: 10,
              manaPoints: 0,
              manaPointsMax: 0,
            },
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    });
  });

  it("passes rolledDice and senderRole: 'master' when rolling free roll from ActorOverlay", async () => {
    const mockCharacter: RosterActor = {
      id: "char-1",
      kind: "character",
      name: "Guerreiro Teste",
      imageUrl: null,
      level: 1,
      xp: 0,
      hitPoints: 10,
      hitPointsMax: 10,
      manaPoints: 5,
      manaPointsMax: 5,
      conditions: [],
    };

    render(
      <ActorOverlay
        actor={mockCharacter}
        campaignId="camp-1"
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    );

    // Navega para aba de rolagem
    const rollTab = screen.getByRole("button", { name: /🎲 Rolagem/i });
    fireEvent.click(rollTab);

    // Clica no botão de rolar dados
    const rollButton = screen.getByRole("button", { name: /Rolar Dados \(Digital\)/i });
    fireEvent.click(rollButton);

    await waitFor(() => {
      expect(mockRollDice).toHaveBeenCalledWith(
        expect.objectContaining({
          campaignId: "camp-1",
          actorId: "char-1",
          senderRole: "master",
          rolledDice: expect.any(Array),
        }),
      );
    });

    const callArgs = mockRollDice.mock.calls[0][0];
    expect(callArgs.rolledDice.length).toBeGreaterThan(0);
    expect(callArgs.rolledDice[0]).toHaveProperty("sides");
    expect(callArgs.rolledDice[0]).toHaveProperty("value");
  });

  it("passes rolledDice and senderRole: 'master' when rolling an NPC action pin outside combat", async () => {
    const mockNpc: RosterActor = {
      id: "npc-1",
      kind: "npc",
      name: "Goblin Chefe",
      imageUrl: null,
      level: 1,
      xp: 0,
      hitPoints: 12,
      hitPointsMax: 12,
      manaPoints: 0,
      manaPointsMax: 0,
      conditions: [],
    };

    render(
      <ActorOverlay actor={mockNpc} campaignId="camp-1" onClose={vi.fn()} onChanged={vi.fn()} />,
    );

    // Aguarda carregar dados do NPC
    const actionRollButton = await screen.findByRole("button", { name: /🎲 Rolar/i });
    fireEvent.click(actionRollButton);

    await waitFor(() => {
      expect(mockRollDice).toHaveBeenCalledWith(
        expect.objectContaining({
          campaignId: "camp-1",
          actorId: "npc-1",
          senderRole: "master",
          rolledDice: expect.any(Array),
        }),
      );
    });

    const callArgs = mockRollDice.mock.calls[0][0];
    expect(callArgs.rolledDice.length).toBeGreaterThan(0);
    expect(callArgs.rolledDice[0]).toHaveProperty("sides");
    expect(callArgs.rolledDice[0]).toHaveProperty("value");
  });
});
