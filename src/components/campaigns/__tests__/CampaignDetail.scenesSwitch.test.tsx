import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { CampaignDetail } from "../CampaignDetail";

// Harness da Fase 2 (issue #86): troca de cena com combate ativo. Espelha o
// harness de CampaignDetail.scenes.test.tsx e acrescenta (a) um SocketContext
// fake que permite "disparar" combat-state para os subscribers e expõe
// updateCombatState como spy, (b) rotas de fetch para encontros do mundo.

type CombatPayload = Record<string, unknown>;

const socketHarness = vi.hoisted(() => {
  const listeners = new Set<(state: CombatPayload) => void>();
  const socket = { emit: vi.fn(), on: vi.fn(), off: vi.fn() };
  return {
    socket,
    listeners,
    subscribeCombatState: vi.fn((cb: (state: CombatPayload) => void) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    }),
    updateCombatState: vi.fn(),
    fireCombat(state: CombatPayload) {
      listeners.forEach((listener) => listener(state));
    },
  };
});

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "camp-1" }),
  useRouter: () => ({ push: vi.fn() }),
}));

// O prop activeScene é lido via data-* para provar a propagação nas duas
// instâncias de MasterRoster (principal e pop-out). `String(undefined)`
// distingue "prop ausente" de cena null (modo Livre).
vi.mock("@/components/campaigns/MasterRoster", () => ({
  MasterRoster: (props: { activeScene?: unknown; onTogglePopOut?: () => void }) => (
    <div data-testid="mock-master-roster" data-active-scene={String(props.activeScene)}>
      <button type="button" data-testid="mock-roster-toggle-popout" onClick={props.onTogglePopOut}>
        popout
      </button>
    </div>
  ),
}));

vi.mock("@/components/campaigns/CampaignInvites", () => ({
  CampaignInvites: () => <div data-testid="campaign-invites" />,
}));
vi.mock("@/components/campaigns/ContentOverlay", () => ({ ContentOverlay: () => null }));
vi.mock("@/components/campaigns/WorldOverlay", () => ({ WorldOverlay: () => null }));
vi.mock("@/components/campaigns/MasterJukebox", () => ({
  MasterJukebox: () => <div data-testid="mock-master-jukebox" />,
}));
vi.mock("@/components/campaigns/SessionLog", () => ({
  SessionLog: () => <div data-testid="session-log-mock" />,
}));
vi.mock("@/components/systems/missing/MissingSessionLog", () => ({
  MissingSessionLog: () => <div data-testid="missing-session-log-mock" />,
}));
// WindowPortal real abriria uma janela do navegador; renderiza os filhos
// inline quando aberto (mesmo mock autorizado de CampaignDetail.shieldGrid).
vi.mock("@/components/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ui")>();
  return {
    ...actual,
    WindowPortal: ({ children, isOpen }: { children: ReactNode; isOpen: boolean }) =>
      isOpen ? <div data-testid="window-portal-mock">{children}</div> : null,
  };
});
vi.mock("@/context/SocketContext", () => ({
  useSocket: () => ({
    socket: socketHarness.socket,
    isConnected: true,
    presenceList: [],
    joinCampaign: vi.fn(),
    subscribeActorStatus: () => () => {},
    subscribeDiceRoll: () => () => {},
    subscribeCombatState: socketHarness.subscribeCombatState,
    updateCombatState: socketHarness.updateCombatState,
  }),
}));

const ACTIVE_COMBAT: CombatPayload = {
  active: true,
  round: 1,
  combatants: [],
  currentTurnIndex: 0,
};

let campaignPayload: Record<string, unknown> = {};
let activeEncounters: Array<Record<string, unknown>> = [];

function jsonResponse(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: async () => body });
}

function patchCalls(urlPattern: RegExp): Array<[string, RequestInit | undefined]> {
  return (
    (global.fetch as ReturnType<typeof vi.fn>).mock.calls as Array<
      [string, RequestInit | undefined]
    >
  ).filter(([url, init]) => urlPattern.test(url) && init?.method === "PATCH");
}

const scenePatches = () => patchCalls(/\/scene$/);
const encounterEndPatches = () => patchCalls(/\/encounters\/[^/]+$/);

async function renderShield() {
  render(<CampaignDetail />);
  await waitFor(() => screen.getByTestId("scene-bar"));
}

describe("CampaignDetail — troca de cena com combate ativo (issue #86, Fase 2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    socketHarness.listeners.clear();
    localStorage.clear();
    activeEncounters = [];
    campaignPayload = {
      id: "camp-1",
      name: "Campanha Teste",
      rulesEngine: "d20_mod",
      masterId: "m1",
      activeScene: "combat",
    };
    global.fetch = vi.fn((url: string) => {
      const target = String(url);
      if (target.endsWith("/scene")) return jsonResponse({ success: true });
      if (target.includes("/worlds/") && target.includes("/encounters")) {
        return jsonResponse({ success: true, data: activeEncounters });
      }
      if (target.includes("/encounters/")) return jsonResponse({ success: true, data: {} });
      if (target.endsWith("/worlds")) {
        return jsonResponse({ data: [{ id: "world-1", name: "Mundo Central", mapUrl: null }] });
      }
      if (target.includes("/establishments") || target.includes("/logs")) {
        return jsonResponse({ data: [] });
      }
      return jsonResponse({ data: campaignPayload });
    }) as unknown as typeof fetch;
  });

  it("caso 1: combate ativo pelo socket + clique em cena não-combate abre o diálogo e não persiste nada", async () => {
    await renderShield();

    act(() => {
      socketHarness.fireCombat(ACTIVE_COMBAT);
    });

    fireEvent.click(screen.getByTestId("scene-btn-interlude"));

    await waitFor(() => expect(screen.getByText("Há um combate em andamento")).toBeInTheDocument());
    expect(scenePatches()).toHaveLength(0);
    expect(encounterEndPatches()).toHaveLength(0);
  });

  it("caso 1b: encontro ativo pelo REST (sem socket) também pede confirmação", async () => {
    activeEncounters = [{ id: "enc-1", worldId: "world-1", name: "Emboscada", isActive: true }];
    await renderShield();

    fireEvent.click(screen.getByTestId("scene-btn-stealth"));

    await waitFor(() => expect(screen.getByText("Há um combate em andamento")).toBeInTheDocument());
    expect(scenePatches()).toHaveLength(0);
  });

  it("caso 2: 'Manter em 2º plano' persiste a cena com encounterAction kept e não encerra o encontro", async () => {
    activeEncounters = [{ id: "enc-1", worldId: "world-1", name: "Emboscada", isActive: true }];
    await renderShield();
    act(() => {
      socketHarness.fireCombat(ACTIVE_COMBAT);
    });

    fireEvent.click(screen.getByTestId("scene-btn-interlude"));
    await waitFor(() => screen.getByText("Há um combate em andamento"));
    fireEvent.click(screen.getByTestId("scene-confirm-keep"));

    await waitFor(() =>
      expect(scenePatches()).toContainEqual([
        "/api/campaigns/camp-1/scene",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ scene: "interlude", encounterAction: "kept" }),
        }),
      ]),
    );
    expect(encounterEndPatches()).toHaveLength(0);
    expect(socketHarness.updateCombatState).not.toHaveBeenCalled();
    expect(screen.queryByText("Há um combate em andamento")).toBeNull();
    // O combate continua ativo em 2º plano: indicador da SceneBar ligado.
    expect(screen.getByTestId("scene-combat-indicator")).toBeInTheDocument();
  });

  it("caso 3: 'Encerrar e trocar' encerra o encontro, reemite combatState inativo e persiste ended", async () => {
    activeEncounters = [{ id: "enc-1", worldId: "world-1", name: "Emboscada", isActive: true }];
    await renderShield();
    act(() => {
      socketHarness.fireCombat(ACTIVE_COMBAT);
    });

    fireEvent.click(screen.getByTestId("scene-btn-interlude"));
    await waitFor(() => screen.getByText("Há um combate em andamento"));
    fireEvent.click(screen.getByTestId("scene-confirm-end"));

    await waitFor(() =>
      expect(encounterEndPatches()).toContainEqual([
        "/api/campaigns/camp-1/encounters/enc-1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ isActive: false }),
        }),
      ]),
    );
    await waitFor(() =>
      expect(scenePatches()).toContainEqual([
        "/api/campaigns/camp-1/scene",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ scene: "interlude", encounterAction: "ended" }),
        }),
      ]),
    );
    expect(socketHarness.updateCombatState).toHaveBeenCalledWith(
      expect.objectContaining({ active: false }),
    );
    expect(screen.queryByText("Há um combate em andamento")).toBeNull();
  });

  it("caso 4: 'Cancelar' fecha o diálogo sem nenhuma requisição de cena ou de encontro", async () => {
    await renderShield();
    act(() => {
      socketHarness.fireCombat(ACTIVE_COMBAT);
    });

    fireEvent.click(screen.getByTestId("scene-btn-interlude"));
    await waitFor(() => screen.getByText("Há um combate em andamento"));
    fireEvent.click(screen.getByTestId("scene-confirm-cancel"));

    await waitFor(() => expect(screen.queryByText("Há um combate em andamento")).toBeNull());
    await act(async () => {});
    expect(scenePatches()).toHaveLength(0);
    expect(encounterEndPatches()).toHaveLength(0);
    expect(screen.getByTestId("scene-mode-label").textContent).toBe("Cena: Combate");
    expect(screen.queryByTestId("scene-combat-indicator")).toBeNull();
  });

  it("caso 5: estabelecimentos visíveis apenas nas cenas Livre e Interlúdio do mundo selecionado", async () => {
    const gate: Array<[string, boolean]> = [
      ["interlude", true],
      ["combat", false],
      ["stealth", false],
      ["investigation", false],
      ["escape", false],
    ];

    for (const [scene, visible] of gate) {
      campaignPayload = { ...campaignPayload, activeScene: scene };
      const { unmount } = render(<CampaignDetail />);
      // Sinal de que a cena do banco já chegou ao estado do escudo (o gate é
      // lido do activeScene, que chega um render depois do carregamento).
      await waitFor(() =>
        expect(screen.getByTestId(`scene-btn-${scene}`)).toHaveAttribute("aria-pressed", "true"),
      );
      await waitFor(() => expect(screen.getByText("Selecionado")).toBeInTheDocument());
      if (visible) {
        expect(screen.getByText("🏬 Estabelecimentos")).toBeInTheDocument();
      } else {
        expect(screen.queryByText("🏬 Estabelecimentos")).toBeNull();
      }
      unmount();
    }

    // Modo Livre (null) = comportamento atual: bloco presente.
    campaignPayload = { ...campaignPayload, activeScene: null };
    render(<CampaignDetail />);
    await waitFor(() =>
      expect(screen.getByTestId("scene-mode-label").textContent).toBe("Cena: Livre"),
    );
    await waitFor(() => expect(screen.getByText("Selecionado")).toBeInTheDocument());
    expect(screen.getByText("🏬 Estabelecimentos")).toBeInTheDocument();
  });

  it("caso 6: sem combate ativo a troca vai direto, sem diálogo e sem encounterAction", async () => {
    await renderShield();

    fireEvent.click(screen.getByTestId("scene-btn-interlude"));

    await waitFor(() => expect(scenePatches()).toHaveLength(1));
    expect(scenePatches()[0]?.[1]?.body).toBe(JSON.stringify({ scene: "interlude" }));
    expect(screen.queryByText("Há um combate em andamento")).toBeNull();
  });

  it("entrar no Combate nunca confirma, mesmo com combate ativo", async () => {
    campaignPayload = { ...campaignPayload, activeScene: "interlude" };
    await renderShield();
    act(() => {
      socketHarness.fireCombat(ACTIVE_COMBAT);
    });

    fireEvent.click(screen.getByTestId("scene-btn-combat"));

    await waitFor(() =>
      expect(scenePatches()).toContainEqual([
        "/api/campaigns/camp-1/scene",
        expect.objectContaining({ method: "PATCH", body: JSON.stringify({ scene: "combat" }) }),
      ]),
    );
    expect(screen.queryByText("Há um combate em andamento")).toBeNull();
    expect(encounterEndPatches()).toHaveLength(0);
  });

  it("sair do Combate para o modo Livre com combate ativo também confirma", async () => {
    await renderShield();
    act(() => {
      socketHarness.fireCombat(ACTIVE_COMBAT);
    });

    fireEvent.click(screen.getByTestId("scene-btn-combat"));

    await waitFor(() => expect(screen.getByText("Há um combate em andamento")).toBeInTheDocument());
    expect(scenePatches()).toHaveLength(0);

    fireEvent.click(screen.getByTestId("scene-confirm-keep"));
    await waitFor(() =>
      expect(scenePatches()).toContainEqual([
        "/api/campaigns/camp-1/scene",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ scene: null, encounterAction: "kept" }),
        }),
      ]),
    );
  });

  it("propaga activeScene para as duas instâncias de MasterRoster (principal e pop-out)", async () => {
    await renderShield();
    expect(screen.getByTestId("mock-master-roster")).toHaveAttribute("data-active-scene", "combat");

    fireEvent.click(screen.getByTestId("mock-roster-toggle-popout"));

    await waitFor(() => expect(screen.getByTestId("window-portal-mock")).toBeInTheDocument());
    expect(screen.getByTestId("mock-master-roster")).toHaveAttribute("data-active-scene", "combat");
  });
});
