import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ActorOverlay, type RosterActor, type NpcPinItem } from "../ActorOverlay";
import type { CombatSessionState } from "@/lib/engine/combat";

const mockRollDice = vi.fn();
const mockRequestDefenseReaction = vi.fn();
const mockUpdateCombatState = vi.fn();

vi.mock("@/context/SocketContext", () => ({
  useSocket: () => ({
    rollDice: mockRollDice,
    updateActorStatus: vi.fn(),
    updateCombatState: mockUpdateCombatState,
    requestDefenseReaction: mockRequestDefenseReaction,
    isConnected: true,
  }),
}));

vi.mock("@/lib/engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/engine")>();
  return { ...actual, spendSpell: vi.fn(), spendCombatActions: vi.fn(() => ({ session: null, spent: true })) };
});

function makePin(overrides: Partial<NpcPinItem> = {}): NpcPinItem {
  return {
    id: "pin-1",
    pinType: "attack",
    label: "Mordissa",
    rollExpression: null,
    attackExpression: "1d20+9",
    damageExpression: "3d6+5",
    damageType: "cortante",
    criticalRange: null,
    ...overrides,
  };
}

function mockNpcFetch(pins: NpcPinItem[]) {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.includes("/content/")) {
      return Promise.resolve({ ok: true, json: async () => [] });
    }
    if (url.includes("/npcs/") || url.includes("/actors/")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: {
            attributes: { forca: 10, destreza: 12, vigor: 10, inteligencia: 8, empatia: 8 },
            pins,
            level: 1,
            xpReward: 10,
            hitPoints: 20,
            hitPointsMax: 20,
            manaPoints: 0,
            manaPointsMax: 0,
          },
        }),
      });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  }) as unknown as typeof fetch;
}

const npcActor: RosterActor = {
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

describe("ActorOverlay — dano configurado do NPC (issue #90)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fora de combate: rola ataque e dano configurados, com formula combinada", async () => {
    mockNpcFetch([makePin()]);
    render(<ActorOverlay actor={npcActor} campaignId="camp-1" onClose={vi.fn()} onChanged={vi.fn()} />);

    const rollButton = await screen.findByRole("button", { name: /🎲 Rolar/i });
    fireEvent.click(rollButton);

    await waitFor(() => {
      expect(mockRollDice).toHaveBeenCalled();
    });

    const call = mockRollDice.mock.calls[0][0];
    expect(call.formula).toBe("1d20+9 (dano 3d6+5)");
    expect(call.rolledDice.length).toBeGreaterThanOrEqual(2);
    expect(call.diceDetail).toContain("Dano:");
  });

  it("fora de combate: ataque sem dano configurado mostra aviso e não registra dano", async () => {
    mockNpcFetch([makePin({ attackExpression: "1d20+7", damageExpression: null, rollExpression: "1d20+7" })]);
    render(<ActorOverlay actor={npcActor} campaignId="camp-1" onClose={vi.fn()} onChanged={vi.fn()} />);

    const rollButton = await screen.findByRole("button", { name: /🎲 Rolar/i });
    fireEvent.click(rollButton);

    await waitFor(() => {
      expect(mockRollDice).toHaveBeenCalled();
    });

    const call = mockRollDice.mock.calls[0][0];
    expect(call.formula).toBe("1d20+7");
    expect(call.diceDetail).toContain("sem dano configurado");
    expect(screen.getByText(/sem dano configurado/i)).toBeInTheDocument();
  });

  it("modificador puro legado (+9) não inventa 1d6+9", async () => {
    mockNpcFetch([makePin({ attackExpression: null, damageExpression: null, rollExpression: "+9" })]);
    render(<ActorOverlay actor={npcActor} campaignId="camp-1" onClose={vi.fn()} onChanged={vi.fn()} />);

    const rollButton = await screen.findByRole("button", { name: /🎲 Rolar/i });
    fireEvent.click(rollButton);

    await waitFor(() => {
      expect(mockRollDice).toHaveBeenCalled();
    });

    const call = mockRollDice.mock.calls[0][0];
    expect(call.formula).toBe("1d20+9");
    expect(call.diceDetail).toContain("sem dano configurado");
  });

  it("tooltip do pin mostra ataque → dano com tipo", async () => {
    mockNpcFetch([makePin()]);
    render(<ActorOverlay actor={npcActor} campaignId="camp-1" onClose={vi.fn()} onChanged={vi.fn()} />);

    const tooltip = await screen.findByTitle("1d20+9 → 3d6+5 cortante");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent("1d20+9 → 3d6+5 (cortante)");
  });

  it("em combate: modal de alvo exibe o dano configurado antes de confirmar", async () => {
    const combatState = {
      active: true,
      round: 1,
      currentTurnIndex: 0,
      combatants: [
        {
          id: "npc-1",
          type: "npc",
          npcId: "npc-1",
          name: "Goblin Chefe",
          initiative: 10,
          actionsRemaining: 1,
          maxActions: 1,
          hpCurrent: 12,
          hpMax: 12,
          vigor: 10,
          destreza: 12,
          level: 1,
        } as unknown as CombatSessionState["combatants"][number],
        {
          id: "npc-2",
          type: "npc",
          npcId: "npc-2",
          name: "Lobo",
          initiative: 5,
          actionsRemaining: 1,
          maxActions: 1,
          hpCurrent: 10,
          hpMax: 10,
          vigor: 10,
          destreza: 10,
          level: 1,
        } as unknown as CombatSessionState["combatants"][number],
      ],
    } as unknown as CombatSessionState;

    mockNpcFetch([makePin()]);
    render(
      <ActorOverlay
        actor={npcActor}
        campaignId="camp-1"
        onClose={vi.fn()}
        onChanged={vi.fn()}
        combatState={combatState}
      />
    );

    const attackButton = await screen.findByRole("button", { name: /⚔️ Atacar/i });
    fireEvent.click(attackButton);

    await waitFor(() => {
      expect(screen.getByTestId("target-damage-preview")).toBeInTheDocument();
    });
    expect(screen.getByTestId("target-damage-preview")).toHaveTextContent("3d6+5 cortante");
  });

  it("em combate: ataque sem dano configurado exibe aviso no modal de alvo", async () => {
    const combatState = {
      active: true,
      round: 1,
      currentTurnIndex: 0,
      combatants: [
        {
          id: "npc-1",
          type: "npc",
          npcId: "npc-1",
          name: "Goblin Chefe",
          initiative: 10,
          actionsRemaining: 1,
          maxActions: 1,
          hpCurrent: 12,
          hpMax: 12,
          vigor: 10,
          destreza: 12,
          level: 1,
        } as unknown as CombatSessionState["combatants"][number],
        {
          id: "npc-2",
          type: "npc",
          npcId: "npc-2",
          name: "Lobo",
          initiative: 5,
          actionsRemaining: 1,
          maxActions: 1,
          hpCurrent: 10,
          hpMax: 10,
          vigor: 10,
          destreza: 10,
          level: 1,
        } as unknown as CombatSessionState["combatants"][number],
      ],
    } as unknown as CombatSessionState;

    mockNpcFetch([makePin({ attackExpression: "1d20+7", damageExpression: null, rollExpression: "1d20+7" })]);
    render(
      <ActorOverlay
        actor={npcActor}
        campaignId="camp-1"
        onClose={vi.fn()}
        onChanged={vi.fn()}
        combatState={combatState}
      />
    );

    const attackButton = await screen.findByRole("button", { name: /⚔️ Atacar/i });
    fireEvent.click(attackButton);

    await waitFor(() => {
      expect(screen.getByTestId("target-no-damage-warning")).toBeInTheDocument();
    });
  });
});
