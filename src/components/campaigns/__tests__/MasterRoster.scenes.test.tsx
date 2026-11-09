import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MasterRoster } from "../MasterRoster";

// Harness espelhado de MasterRoster.visibility.test.tsx (mocks de socket,
// fetch e filhos pesados), estendido com updateCombatState e limpeza de
// localStorage entre casos.

// Captura o callback de subscribeCombatState para que os testes injetem
// estado de combate "pelo socket" (necessário nos casos de automação).
const socketHarness = vi.hoisted(() => ({
  combatCallback: null as null | ((state: unknown) => void),
}));

// Mock dependencies
vi.mock("@/context/SocketContext", () => ({
  useSocket: () => ({
    socket: null,
    isConnected: true,
    presenceList: [],
    joinCampaign: vi.fn(),
    subscribeActorStatus: vi.fn(() => vi.fn()),
    subscribeDiceRoll: vi.fn(() => vi.fn()),
    subscribeCombatState: vi.fn((cb: (state: unknown) => void) => {
      socketHarness.combatCallback = cb;
      return vi.fn();
    }),
    updateCombatState: vi.fn(),
  }),
}));

vi.mock("@/components/campaigns/InfiniteCanvas", () => ({
  InfiniteCanvas: () => <div data-testid="mock-infinite-canvas">Canvas Active</div>,
}));

vi.mock("@/components/campaigns/CharacterCarousel", () => ({
  CharacterCarousel: () => <div data-testid="mock-character-carousel">Carousel Active</div>,
}));

vi.mock("@/components/campaigns/MapEditor", () => ({
  MapEditor: () => <div data-testid="mock-map-editor">Map Active</div>,
}));

// Mock do EncounterModal: a presença do div sinaliza o modal aberto; o botão
// interno chama onClose para simular o fechamento "pelo usuário" sem
// depender da UI real do modal.
vi.mock("../EncounterModal", () => ({
  EncounterModal: ({ onClose }: { onClose?: () => void }) => (
    <div data-testid="encounter-modal-mock">
      <button type="button" data-testid="encounter-modal-close" onClick={onClose}>
        fechar-mock
      </button>
    </div>
  ),
}));

vi.mock("next/dynamic", () => ({
  __esModule: true,
  default: () => {
    const DynamicComponent = () => <div data-testid="mock-dynamic-map">Map Component</div>;
    DynamicComponent.displayName = "DynamicComponent";
    return DynamicComponent;
  },
}));

global.fetch = vi.fn();

// Implementação padrão de fetch (sem encontro ativo) compartilhada entre os
// dois describes; casos específicos podem sobrescrevê-la no próprio teste.
const defaultFetchImpl = (url: string) => {
  if (url.includes("/roster")) {
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            players: [],
            npcs: [],
          },
        }),
    });
  }
  if (url.includes("/worlds") && !url.includes("/encounters")) {
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: [{ id: "world-1", name: "Mundo Central", mapUrl: "http://example.com/map.jpg" }],
        }),
    });
  }
  if (url.includes("/encounters")) {
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: [],
        }),
    });
  }
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ success: true, data: {} }),
  });
};

describe("MasterRoster — matriz de visibilidade por cena (Fase 2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(defaultFetchImpl);
  });

  it("caso 1: activeScene=interlude esconde a barra de combate e o carrossel", async () => {
    render(
      <MasterRoster
        campaignId="test-camp"
        selectedWorldId="world-1"
        activeScene="interlude"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("mock-infinite-canvas")).toBeInTheDocument();
    });

    // Barra de combate ausente (nem o botão nem o título de encontro ativo)
    expect(screen.queryByText(/Iniciar Encontro/)).toBeNull();
    expect(screen.queryByText(/COMBATE ATIVO/)).toBeNull();
    expect(screen.queryByText(/Nenhum combate ativo/)).toBeNull();
    // Carrossel ausente, sem sobrescrever preferências
    expect(screen.queryByTestId("resize-carousel-panel")).toBeNull();
    expect(screen.queryByTestId("mock-character-carousel")).toBeNull();
  });

  it("caso 2: activeScene=combat força o carrossel visível mesmo colapsado, sem sobrescrever localStorage", async () => {
    localStorage.setItem("carousel-collapsed-test-camp", "true");

    render(
      <MasterRoster
        campaignId="test-camp"
        selectedWorldId="world-1"
        activeScene="combat"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("resize-carousel-panel")).toBeInTheDocument();
    });
    expect(screen.getByTestId("mock-character-carousel")).toBeInTheDocument();
    // A preferência salva permanece intacta ("visible" não reescreve o colapso)
    expect(localStorage.getItem("carousel-collapsed-test-camp")).toBe("true");
  });

  it("caso 3: activeScene=null (Livre) preserva o comportamento atual (colapso esconde)", async () => {
    localStorage.setItem("carousel-collapsed-test-camp", "true");

    render(
      <MasterRoster
        campaignId="test-camp"
        selectedWorldId="world-1"
        activeScene={null}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("mock-infinite-canvas")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("resize-carousel-panel")).toBeNull();
    // A barra neutra continua renderizada como hoje
    expect(screen.getByText(/Nenhum combate ativo/)).toBeInTheDocument();
  });

  it("caso 4: activeScene=combat sem mundo selecionado mostra o hint de mundo na barra", async () => {
    render(
      <MasterRoster
        campaignId="test-camp"
        selectedWorldId=""
        activeScene="combat"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("scene-combat-world-hint")).toBeInTheDocument();
    });
  });

  it("caso 5: missing_zero ignora a matriz (tudo como hoje com activeScene=combat)", async () => {
    // Colapso salvo: sob a matriz "combat" o carrossel seria forçado visível;
    // como missing neutraliza a matriz, o colapso (comportamento de hoje) vence.
    // Se `isMissing ? NEUTRAL_MODULES : …` fosse apagado, o painel reapareceria.
    localStorage.setItem("carousel-collapsed-test-camp", "true");

    render(
      <MasterRoster
        campaignId="test-camp"
        selectedWorldId="world-1"
        rulesEngine="missing_zero"
        activeScene="combat"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("[ REGISTRO CIVIL // HABITANTES DA REGIÃO ]")).toBeInTheDocument();
    });

    // Barra do Missing no lugar da barra de combate d20
    expect(screen.queryByText(/Iniciar Encontro/)).toBeNull();
    // Neutro → colapso salvo vence (a matriz "visible" de combat NÃO se aplica)
    expect(screen.queryByTestId("resize-carousel-panel")).toBeNull();
    expect(screen.queryByTestId("mock-character-carousel")).toBeNull();
  });

  it("caso 5b: missing_zero com cena de matriz hidden (stealth) mantém a barra de Registro Civil", async () => {
    render(
      <MasterRoster
        campaignId="test-camp"
        selectedWorldId="world-1"
        rulesEngine="missing_zero"
        activeScene="stealth"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("mock-infinite-canvas")).toBeInTheDocument();
    });

    // Matriz de stealth (combatBar/carousel hidden) NÃO se aplica a missing:
    // barra do Registro Civil presente e carrossel visível como hoje.
    // Se `isMissing ? NEUTRAL_MODULES : …` fosse apagado, a barra sumiria.
    expect(screen.getByText("[ REGISTRO CIVIL // HABITANTES DA REGIÃO ]")).toBeInTheDocument();
    expect(screen.getByTestId("resize-carousel-panel")).toBeInTheDocument();
    expect(screen.getByTestId("mock-character-carousel")).toBeInTheDocument();
  });

  it("caso 6: combat com colapso salvo força o carrossel e omite o toggle de colapso", async () => {
    localStorage.setItem("carousel-collapsed-test-camp", "true");

    render(
      <MasterRoster
        campaignId="test-camp"
        selectedWorldId="world-1"
        activeScene="combat"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("resize-carousel-panel")).toBeInTheDocument();
    });

    // Com o colapso salvo, sem a correção o botão toggle do ramo de combate
    // seria renderizado com o rótulo "Expandir" (estado dessincronizado do
    // carrossel forçado). Com "visible" forçado pela matriz, nenhum toggle.
    expect(screen.queryByText("Recolher")).toBeNull();
    expect(screen.queryByText("Expandir")).toBeNull();
    // A preferência salva continua intacta
    expect(localStorage.getItem("carousel-collapsed-test-camp")).toBe("true");
  });

  it("caso 7: estado Livre (null) mantém o toggle de colapso presente como hoje", async () => {
    localStorage.setItem("carousel-collapsed-test-camp", "true");

    render(
      <MasterRoster
        campaignId="test-camp"
        selectedWorldId="world-1"
        activeScene={null}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Nenhum combate ativo/)).toBeInTheDocument();
    });

    // Neutro + colapso salvo → carrossel escondido e o botão "Expandir" presente
    expect(screen.queryByTestId("resize-carousel-panel")).toBeNull();
    expect(screen.getByText("Expandir")).toBeInTheDocument();
  });
});

describe("MasterRoster — automação do encontro na cena Combate (Fase 2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    socketHarness.combatCallback = null;
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(defaultFetchImpl);
  });

  it("caso 1: ENTRAR em combat sem encontro ativo abre o EncounterModal", async () => {
    const { rerender } = render(
      <MasterRoster
        campaignId="test-camp"
        selectedWorldId="world-1"
        activeScene="investigation"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("mock-infinite-canvas")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("encounter-modal-mock")).toBeNull();

    rerender(
      <MasterRoster
        campaignId="test-camp"
        selectedWorldId="world-1"
        activeScene="combat"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("encounter-modal-mock")).toBeInTheDocument();
    });
  });

  it("caso 2: ENTRAR em combat com encontro ativo NÃO abre o modal (retomada silenciosa)", async () => {
    // Referência única e estável: o mock de useSocket recria as funções a cada
    // render, então o poll de checkActive reexecuta; se o objeto do encontro
    // mudasse de identidade a cada resposta, setActiveEncounter re-renderizaria
    // em loop. Com referência estável o React baila e o efeito estabiliza.
    const activeEncounterFixture = { id: "enc-1", name: "Emboscada", isActive: true };
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes("/encounters")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: [activeEncounterFixture],
            }),
        });
      }
      return defaultFetchImpl(url);
    });

    const { rerender } = render(
      <MasterRoster
        campaignId="test-camp"
        selectedWorldId="world-1"
        activeScene={null}
      />
    );

    // Sinal positivo de que o encontro ativo chegou ao estado do componente
    // (barra neutra visível em cena Livre).
    await waitFor(() => {
      expect(screen.getByText(/COMBATE ATIVO : Emboscada/)).toBeInTheDocument();
    });

    rerender(
      <MasterRoster
        campaignId="test-camp"
        selectedWorldId="world-1"
        activeScene="combat"
      />
    );

    // Flush de microtarefas pendentes (fetches do harness) dentro de act para
    // evitar updates fora de act e garantir que nada reabriu o modal.
    await act(async () => {});
    expect(screen.queryByTestId("encounter-modal-mock")).toBeNull();
  });

  it("caso 2b: ENTRAR em combat com combatState ativo (socket) também retoma em silêncio", async () => {
    const { rerender } = render(
      <MasterRoster
        campaignId="test-camp"
        selectedWorldId="world-1"
        activeScene={null}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("mock-infinite-canvas")).toBeInTheDocument();
    });
    expect(socketHarness.combatCallback).not.toBeNull();

    act(() => {
      socketHarness.combatCallback?.({ active: true, round: 1, combatants: [], currentTurnIndex: 0 });
    });
    await waitFor(() => {
      expect(screen.getByText(/COMBATE ATIVO/)).toBeInTheDocument();
    });

    rerender(
      <MasterRoster
        campaignId="test-camp"
        selectedWorldId="world-1"
        activeScene="combat"
      />
    );

    await act(async () => {});
    expect(screen.queryByTestId("encounter-modal-mock")).toBeNull();
  });

  it("caso 3: SAIR de combat com o modal aberto fecha o modal", async () => {
    // Ruling da Task 2: a entrada precisa ser uma TRANSIÇÃO real (montar em
    // Livre e rerenderizar em combat), não um mount direto na cena.
    const { rerender } = render(
      <MasterRoster
        campaignId="test-camp"
        selectedWorldId="world-1"
        activeScene={null}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("mock-infinite-canvas")).toBeInTheDocument();
    });

    rerender(
      <MasterRoster
        campaignId="test-camp"
        selectedWorldId="world-1"
        activeScene="combat"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("encounter-modal-mock")).toBeInTheDocument();
    });

    rerender(
      <MasterRoster
        campaignId="test-camp"
        selectedWorldId="world-1"
        activeScene="interlude"
      />
    );

    await waitFor(() => {
      expect(screen.queryByTestId("encounter-modal-mock")).toBeNull();
    });
  });

  it("caso 4: reprocessar o mesmo activeScene não reabre o modal (guarda por ref)", async () => {
    const { rerender } = render(
      <MasterRoster
        campaignId="test-camp"
        selectedWorldId="world-1"
        activeScene={null}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("mock-infinite-canvas")).toBeInTheDocument();
    });

    rerender(
      <MasterRoster
        campaignId="test-camp"
        selectedWorldId="world-1"
        activeScene="combat"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("encounter-modal-mock")).toBeInTheDocument();
    });

    // Fecha "pelo usuário" via onClose do modal mockado.
    fireEvent.click(screen.getByTestId("encounter-modal-close"));
    expect(screen.queryByTestId("encounter-modal-mock")).toBeNull();

    // Muda um dep do efeito (combatState) sem mudar a cena: sem a guarda por
    // ref isso reexecitaria a lógica de entrada em combat e reabriria o modal
    // (combatState chega inativo e não há encontro ativo).
    act(() => {
      socketHarness.combatCallback?.({ active: false, round: 2, combatants: [], currentTurnIndex: 0 });
    });
    rerender(
      <MasterRoster
        campaignId="test-camp"
        selectedWorldId="world-1"
        activeScene="combat"
      />
    );

    await act(async () => {});
    expect(screen.queryByTestId("encounter-modal-mock")).toBeNull();
  });

  it("caso 4b: MONTAR direto em combat (reload/remount) é baseline e NÃO abre o modal", async () => {
    // Política da correção levada da Task 2: a primeira execução do efeito sem
    // referência anterior semeia a cena atual em vez de contar como "entrar na
    // cena". Cobre reload da página em combate e o remount por
    // key={`roster-${rosterVersion}`} ao fechar o ContentOverlay.
    render(
      <MasterRoster
        campaignId="test-camp"
        selectedWorldId="world-1"
        activeScene="combat"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("mock-infinite-canvas")).toBeInTheDocument();
    });
    await act(async () => {});

    expect(screen.queryByTestId("encounter-modal-mock")).toBeNull();
  });

  it("caso 5: missing_zero nunca abre o modal ao entrar em combat (efeito no-op)", async () => {
    const { rerender } = render(
      <MasterRoster
        campaignId="test-camp"
        selectedWorldId="world-1"
        rulesEngine="missing_zero"
        activeScene={null}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("[ REGISTRO CIVIL // HABITANTES DA REGIÃO ]")).toBeInTheDocument();
    });

    rerender(
      <MasterRoster
        campaignId="test-camp"
        selectedWorldId="world-1"
        rulesEngine="missing_zero"
        activeScene="combat"
      />
    );

    await act(async () => {});
    expect(screen.queryByTestId("encounter-modal-mock")).toBeNull();
  });
});
