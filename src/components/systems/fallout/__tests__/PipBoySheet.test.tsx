import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PipBoySheet } from "../PipBoySheet";
import {
  createInitialFalloutCharacter,
  evaluateRollDice,
  getRadiationCondition,
} from "@/lib/systems/fallout/rules";
import type { FalloutRadiationBroadcast, FalloutRollResult } from "@/lib/systems/fallout/types";

const socketMock = vi.hoisted(() => ({
  rollDice: vi.fn(),
  emitFalloutApUpdate: vi.fn(),
  subscribeFalloutApUpdate: vi.fn(() => () => {}),
  emitFalloutDiceRoll: vi.fn(),
  subscribeFalloutDiceRoll: vi.fn(() => () => {}),
  emitFalloutRadiationUpdate: vi.fn(),
  subscribeFalloutRadiationUpdate: vi.fn<
    (listener: (payload: FalloutRadiationBroadcast) => void) => () => void
  >(() => () => {}),
}));

vi.mock("@/context/SocketContext", () => ({
  useSocket: () => socketMock,
}));

const CAMPAIGN_ID = "8f14e45f-ceea-467f-a830-a3d5f5c1a2b7";
const ROLL_ID = "11111111-1111-4111-8111-111111111111";

function ok(data: unknown) {
  return { ok: true, status: 200, json: async () => ({ success: true, data }) };
}

function serverRoll(rollResult: FalloutRollResult, overrides: Record<string, unknown> = {}) {
  return {
    rollId: ROLL_ID,
    rollResult,
    hitLocation: null,
    rerolledIndexes: [],
    ap: { partyAP: 3, maxPartyAP: 6, overseerAP: 2 },
    apCost: 0,
    apGenerated: rollResult.apGenerated,
    luckCost: 0,
    luckPointsCurrent: 6,
    baseDifficulty: 1,
    ...overrides,
  };
}

// Tag Skill com rank 3: TN 11, crítico em 1-3.
const rollParams = {
  attributeValue: 8,
  skillRank: 3,
  isTagSkill: true,
  difficulty: 1,
};

describe("PipBoySheet & Componentes Fallout 2d20", () => {
  const sampleCharacter = {
    ...createInitialFalloutCharacter(
      {
        name: "Cooper Howard",
        origin: "ghoul",
        level: 3,
        xp: 350,
        attributes: {
          str: 6,
          per: 8,
          end: 7,
          cha: 5,
          int: 6,
          agi: 9,
          luc: 6,
        },
        tagSkills: ["small_guns", "survival", "speech"],
        perks: [],
        caps: 250,
      },
      "user-1",
      "char-cooper",
    ),
    campaignId: CAMPAIGN_ID,
  };

  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).endsWith("/ap")) {
        return ok({ campaignId: CAMPAIGN_ID, partyAP: 3, overseerAP: 2, maxPartyAP: 6 });
      }
      throw new Error(`fetch não previsto: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    socketMock.subscribeFalloutApUpdate.mockImplementation(() => () => {});
    socketMock.subscribeFalloutRadiationUpdate.mockImplementation(() => () => {});
  });

  async function renderSheet(
    props: Partial<React.ComponentProps<typeof PipBoySheet>> = {},
    initialPool = "3/6",
  ) {
    await act(async () => {
      render(<PipBoySheet character={sampleCharacter} {...props} />);
    });
    // Espera o pool de AP chegar do servidor antes de qualquer interação.
    await waitFor(() =>
      expect(screen.getByTestId("fallout-ap-tracker")).toHaveTextContent(initialPool),
    );
  }

  it("renderiza retrato, nome, PV/Radiação, AP da Equipe e os 7 atributos na aba STAT", async () => {
    await renderSheet();

    expect(screen.getByTestId("pipboy-sheet")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cooper Howard" })).toBeInTheDocument();
    expect(screen.getByTestId("pipboy-portrait")).toBeInTheDocument();
    expect(screen.getByTestId("fallout-ap-tracker")).toBeInTheDocument();
    expect(screen.getByText(/AP EQUIPE:/i)).toBeInTheDocument();
    expect(screen.getByText("3/6")).toBeInTheDocument();

    // Os 7 atributos S.P.E.C.I.A.L. agora ficam na aba STAT
    expect(screen.getByText("Força")).toBeInTheDocument();
    expect(screen.getByText("Percepção")).toBeInTheDocument();
    expect(screen.getByText("Agilidade")).toBeInTheDocument();

    // A tag "RobCo Pip-Boy 3000 Mk IV" foi removida do cabeçalho
    expect(screen.queryByText("RobCo Pip-Boy 3000 Mk IV")).not.toBeInTheDocument();

    // O paperdoll não fica na aba STAT
    expect(screen.queryByTestId("pipboy-paperdoll")).not.toBeInTheDocument();
  });

  it("marca o Necrótico como imune à radiação na leitura de RADS", async () => {
    await renderSheet();

    expect(screen.getByTestId("radiation-condition")).toHaveTextContent("Imune");
    expect(screen.getByText("RADS: 0")).toBeInTheDocument();
  });

  it("move o Monitor de Membros & Armadura para a aba INV com os 6 membros", async () => {
    await renderSheet();

    fireEvent.click(screen.getByRole("tab", { name: "INV" }));

    expect(screen.getByTestId("pipboy-paperdoll")).toBeInTheDocument();
    expect(screen.getByText("Monitor de Membros & Armadura")).toBeInTheDocument();
    expect(screen.getByText("Cabeça")).toBeInTheDocument();
    expect(screen.getByText("Tronco")).toBeInTheDocument();
    expect(screen.getByText("Braço Esquerdo")).toBeInTheDocument();
    expect(screen.getByText("Braço Direito")).toBeInTheDocument();
    expect(screen.getByText("Perna Esquerda")).toBeInTheDocument();
    expect(screen.getByText("Perna Direita")).toBeInTheDocument();
  });

  it("alterna entre STAT, S.P.E.C.I.A.L., INV e DATA (perícias só em SPECIAL)", async () => {
    await renderSheet();

    fireEvent.click(screen.getByRole("tab", { name: "S.P.E.C.I.A.L." }));
    expect(screen.getByText("Armas Leves")).toBeInTheDocument();
    expect(screen.getByText("Ciência")).toBeInTheDocument();
    // Os atributos não ficam mais na aba SPECIAL
    expect(screen.queryByText("Força")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "INV" }));
    expect(screen.getByText(/Capacidade de Carga Máxima/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "DATA" }));
    expect(screen.getByText(/350 XP/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "STAT" }));
    expect(screen.getByTestId("fallout-ap-tracker")).toBeInTheDocument();
    expect(screen.getByText("Força")).toBeInTheDocument();

    // A aba STAT remontou o rastreador, que recarrega o pool do servidor.
    await waitFor(() => expect(screen.getByTestId("fallout-ap-tracker")).toHaveTextContent("3/6"));

    // A aba CORPO foi removida
    expect(screen.queryByRole("tab", { name: "CORPO" })).not.toBeInTheDocument();
  });

  it("remove os steppers +/- de PV e Radiação, mantém AP e sintetiza as stats em linha", async () => {
    await renderSheet({ onUpdateCharacter: vi.fn() });

    expect(screen.queryByRole("button", { name: "Aumentar PV" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reduzir PV" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aumentar Radiação" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reduzir Radiação" })).not.toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Adicionar 1 AP" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gastar 1 AP" })).toBeInTheDocument();

    expect(screen.getByText("Defesa")).toBeInTheDocument();
    expect(screen.getByText("Iniciativa")).toBeInTheDocument();
    expect(screen.getByText("Caps")).toBeInTheDocument();
  });

  it("ajusta o AP da Equipe por delta e ecoa o valor devolvido pelo servidor", async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).endsWith("/ap") && init?.method === "POST") {
        expect(JSON.parse(String(init.body))).toEqual({ deltaParty: 1, deltaOverseer: 0 });
        return ok({ campaignId: CAMPAIGN_ID, partyAP: 4, overseerAP: 2, maxPartyAP: 6 });
      }
      return ok({ campaignId: CAMPAIGN_ID, partyAP: 3, overseerAP: 2, maxPartyAP: 6 });
    });

    await renderSheet();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Adicionar 1 AP" }));
    });

    expect(screen.getByText("4/6")).toBeInTheDocument();
    expect(socketMock.emitFalloutApUpdate).toHaveBeenCalledWith({
      campaignId: CAMPAIGN_ID,
      partyAP: 4,
      overseerAP: 2,
    });
  });

  it("remove os steppers +/- de rank das perícias na aba S.P.E.C.I.A.L.", async () => {
    await renderSheet({ onUpdateCharacter: vi.fn() });

    fireEvent.click(screen.getByRole("tab", { name: "S.P.E.C.I.A.L." }));

    expect(screen.getAllByRole("button", { name: "Rolar" })).toHaveLength(17);
    expect(screen.getAllByRole("button", { name: "★" })).toHaveLength(17);
    // 17★ + 17 Rolar + 1 FAB = 35 botões (nenhum stepper de rank restante)
    expect(screen.getAllByRole("button")).toHaveLength(35);
  });

  it("abre o modal de rolagem 2d20 / DC pelo botão flutuante e executa o teste no servidor", async () => {
    const success = evaluateRollDice([3, 7], rollParams);
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).endsWith("/roll") && init?.method === "POST") {
        return ok(
          serverRoll(success, { apCost: 6, ap: { partyAP: 0, maxPartyAP: 6, overseerAP: 2 } }),
        );
      }
      return ok({ campaignId: CAMPAIGN_ID, partyAP: 6, overseerAP: 2, maxPartyAP: 6 });
    });

    await renderSheet({}, "6/6");

    const fab = screen.getByTestId("pipboy-roll-fab");
    expect(fab).toHaveAttribute("aria-label", "Rolar 2d20 / DC");

    fireEvent.click(screen.getByRole("button", { name: /Rolar 2d20 \/ DC/i }));
    expect(screen.queryByText("Terminal de Rolagem Pip-Boy 2d20")).toBeNull();
    expect(
      screen.getByRole("dialog", { name: "Terminal de Rolagem Pip-Boy 2d20" }),
    ).toBeInTheDocument();

    // Dificuldade, Dados Extras e Complicação agora são sliders temáticos.
    expect(screen.getAllByRole("slider")).toHaveLength(3);
    expect(screen.getByRole("slider", { name: "Dificuldade" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Complicação" })).toBeInTheDocument();

    await waitFor(() => expect(screen.getByTestId("roller-party-ap")).toHaveTextContent("6/6"));

    const extraSlider = screen.getByRole("slider", { name: "Dados Extras" });
    fireEvent.change(extraSlider, { target: { value: "3" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Executar Teste \(5d20\)/i }));
    });

    expect(screen.getByTestId("fallout-2d20-result")).toBeInTheDocument();
    expect(screen.getByText("SUCESSO NO TESTE!")).toBeInTheDocument();

    const rollCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/roll"));
    expect(JSON.parse(String(rollCall?.[1]?.body))).toEqual({
      characterId: "char-cooper",
      attribute: "agi",
      skill: "small_guns",
      difficulty: 1,
      extraDiceCount: 3,
      complicationThreshold: 20,
      rollLocation: true,
    });

    // Teste bem-sucedido não oferece re-rolagem com Sorte.
    expect(screen.queryByTestId("luck-reroll-hint")).not.toBeInTheDocument();
    expect(screen.queryByTestId("luck-reroll-0")).not.toBeInTheDocument();

    // O custo dos 3 dados extras saiu do pool e o novo saldo veio do servidor.
    expect(screen.getByText("-6 AP do pool")).toBeInTheDocument();
    expect(screen.getByTestId("roller-party-ap")).toHaveTextContent("0/6");
  });

  it("bloqueia dados extras quando o AP da Equipe não cobre o custo", async () => {
    await renderSheet();

    fireEvent.click(screen.getByTestId("pipboy-roll-fab"));
    await waitFor(() => expect(screen.getByTestId("roller-party-ap")).toHaveTextContent("3/6"));
    fireEvent.change(screen.getByRole("slider", { name: "Dados Extras" }), {
      target: { value: "3" },
    });

    expect(screen.getByText("6 AP")).toBeInTheDocument();
    expect(screen.getByText(/pool insuficiente/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Executar Teste \(5d20\)/i })).toBeDisabled();

    fireEvent.change(screen.getByRole("slider", { name: "Dados Extras" }), {
      target: { value: "1" },
    });
    expect(screen.getByRole("button", { name: /Executar Teste \(3d20\)/i })).toBeEnabled();
  });

  it("oferece re-rolagem dado a dado em teste falho e debita 1 Ponto de Sorte por dado", async () => {
    const failure = evaluateRollDice([15, 18], rollParams);
    const afterReroll = evaluateRollDice([2, 18], rollParams);
    const onLuckSpent = vi.fn();

    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).endsWith("/roll/reroll") && init?.method === "POST") {
        return ok(
          serverRoll(afterReroll, {
            rerolledIndexes: [0],
            luckCost: 1,
            luckPointsCurrent: 5,
            ap: { partyAP: 5, maxPartyAP: 6, overseerAP: 2 },
          }),
        );
      }
      if (String(url).endsWith("/roll") && init?.method === "POST") {
        return ok(serverRoll(failure));
      }
      return ok({ campaignId: CAMPAIGN_ID, partyAP: 3, overseerAP: 2, maxPartyAP: 6 });
    });

    await renderSheet({ onLuckSpent });

    fireEvent.click(screen.getByTestId("pipboy-roll-fab"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Executar Teste \(2d20\)/i }));
    });

    expect(screen.getByText("FALHA NO TESTE")).toBeInTheDocument();
    expect(screen.getByTestId("luck-reroll-hint")).toHaveTextContent("1 Ponto de Sorte por dado");
    expect(
      screen.getAllByRole("button", { name: /Re-rolar dado \d por 1 Ponto de Sorte/ }),
    ).toHaveLength(2);

    await act(async () => {
      fireEvent.click(screen.getByTestId("luck-reroll-0"));
    });

    const rerollCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/roll/reroll"));
    expect(JSON.parse(String(rerollCall?.[1]?.body))).toEqual({ rollId: ROLL_ID, dieIndex: 0 });

    expect(screen.getByText("SUCESSO NO TESTE!")).toBeInTheDocument();
    expect(screen.getByTestId("roller-luck")).toHaveTextContent("5/6");
    expect(onLuckSpent).toHaveBeenCalledWith(5);
    expect(screen.getByTestId("fallout-ap-generated")).toHaveTextContent("+1 AP");
    // O dado já re-rolado sai da oferta; o teste passou, então nada mais é oferecido.
    expect(screen.queryByTestId("luck-reroll-0")).not.toBeInTheDocument();
    expect(screen.queryByTestId("luck-reroll-1")).not.toBeInTheDocument();
  });

  it("aplica a radiação recebida em tempo real no teto de PV e na condição", async () => {
    await renderSheet({ character: { ...sampleCharacter, origin: "wastelander" } });

    const listener = socketMock.subscribeFalloutRadiationUpdate.mock.calls.at(-1)?.[0] as (
      payload: FalloutRadiationBroadcast,
    ) => void;

    const condition = getRadiationCondition(8, 15);
    await act(async () => {
      listener({
        campaignId: CAMPAIGN_ID,
        delta: 8,
        characters: [
          {
            characterId: "char-cooper",
            name: "Cooper Howard",
            radiation: 8,
            hpCurrent: 7,
            hpMax: 15,
            condition,
          },
        ],
      });
    });

    await waitFor(() => expect(screen.getByText("RADS: 8")).toBeInTheDocument());
    expect(screen.getByText("PV: 7 / 7")).toBeInTheDocument();
    expect(screen.getByTestId("radiation-condition")).toHaveTextContent("Debilitado");
    expect(screen.getByTestId("radiation-condition")).toHaveTextContent("+1D");
  });
});
