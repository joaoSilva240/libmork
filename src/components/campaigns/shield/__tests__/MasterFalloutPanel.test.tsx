import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MasterFalloutPanel } from "../MasterFalloutPanel";
import { createInitialFalloutCharacter, getRadiationCondition } from "@/lib/systems/fallout/rules";
import type {
  FalloutCharacter,
  FalloutOrigin,
  FalloutRadiationBroadcast,
} from "@/lib/systems/fallout/types";

const socketMock = vi.hoisted(() => ({
  emitFalloutApUpdate: vi.fn(),
  subscribeFalloutApUpdate: vi.fn<
    (
      listener: (payload: { campaignId: string; partyAP?: number; overseerAP?: number }) => void,
    ) => () => void
  >(() => () => {}),
  emitFalloutRadiationUpdate: vi.fn(),
  subscribeFalloutRadiationUpdate: vi.fn<
    (listener: (payload: FalloutRadiationBroadcast) => void) => () => void
  >(() => () => {}),
}));

vi.mock("@/context/SocketContext", () => ({
  useSocket: () => socketMock,
}));

const CAMPAIGN_ID = "8f14e45f-ceea-467f-a830-a3d5f5c1a2b7";

const attributes = { str: 6, per: 7, end: 8, cha: 5, int: 6, agi: 7, luc: 5 };

function survivor(id: string, name: string, origin: FalloutOrigin): FalloutCharacter {
  return {
    ...createInitialFalloutCharacter(
      { name, origin, level: 1, xp: 0, attributes, tagSkills: [], perks: [], caps: 0 },
      "user-1",
      id,
    ),
    campaignId: CAMPAIGN_ID,
  };
}

// hpMax = END 8 + LUC 5 = 13 para todos.
const roster = [
  survivor("char-nora", "Nora", "vault_dweller"),
  survivor("char-cooper", "Cooper Howard", "ghoul"),
  survivor("char-codsworth", "Codsworth", "mister_handy"),
];

function ok(data: unknown) {
  return { ok: true, status: 200, json: async () => ({ success: true, data }) };
}

function apState(partyAP: number, overseerAP: number) {
  return { campaignId: CAMPAIGN_ID, partyAP, overseerAP, maxPartyAP: 6 };
}

function radiationResponse(delta: number, radiation: number) {
  return {
    campaignId: CAMPAIGN_ID,
    delta,
    updated: [
      {
        characterId: "char-nora",
        name: "Nora",
        radiation,
        hpCurrent: Math.min(13, 13 - radiation),
        hpMax: 13,
        condition: getRadiationCondition(radiation, 13),
      },
    ],
    immune: [],
  };
}

describe("MasterFalloutPanel — card de recursos do Escudo (Fallout 2d20)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("/characters?campaignId=")) return ok(roster);
      if (String(url).endsWith("/ap")) return ok(apState(3, 2));
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

  async function renderPanel(expectedPool = "3/6") {
    await act(async () => {
      render(<MasterFalloutPanel campaignId={CAMPAIGN_ID} />);
    });
    await waitFor(() => expect(screen.getByText("1/1 alvos")).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByTestId("card-party-ap")).toHaveTextContent(expectedPool),
    );
  }

  it("reúne AP da Equipe, AP do Supervisor e Radiação em um único card", async () => {
    await renderPanel();

    expect(screen.getByTestId("fallout-shield-panel")).toBeInTheDocument();
    expect(screen.getByTestId("fallout-ap-card")).toBeInTheDocument();
    expect(screen.getByTestId("fallout-overseer-card")).toBeInTheDocument();
    expect(screen.getByTestId("fallout-radiation-card")).toBeInTheDocument();
    expect(screen.getByTestId("card-party-ap")).toHaveTextContent("3/6");
    expect(screen.getByTestId("card-overseer-ap")).toHaveTextContent("2");
  });

  it("pré-seleciona apenas sobreviventes vulneráveis e ignora as origens imunes", async () => {
    await renderPanel();

    expect(screen.getByRole("checkbox", { name: "Selecionar Nora" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Selecionar Cooper Howard" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Selecionar Codsworth" })).toBeDisabled();
    expect(screen.getAllByText("Imune")).toHaveLength(2);
    expect(screen.getByText("Necrótico (Ghoul)")).toBeInTheDocument();
  });

  it("aplica +1 RAD nos alvos escolhidos, ecoa o servidor e transmite no socket", async () => {
    let live = roster.map((c) => ({ ...c }));
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).endsWith("/radiation") && init?.method === "POST") {
        live = live.map((c) => (c.id === "char-nora" ? { ...c, radiation: 1, hpCurrent: 12 } : c));
        return ok(radiationResponse(1, 1));
      }
      if (String(url).endsWith("/ap")) return ok(apState(3, 2));
      return ok(live);
    });

    await renderPanel();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Aumentar 1 de radiação" }));
    });

    const post = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/radiation"));
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({
      campaignId: CAMPAIGN_ID,
      characterIds: ["char-nora"],
      delta: 1,
    });

    expect(screen.getByTestId("radiation-feedback")).toHaveTextContent(
      "+1 RADS em 1 sobrevivente(s)",
    );
    expect(socketMock.emitFalloutRadiationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ campaignId: CAMPAIGN_ID, delta: 1 }),
    );

    expect(screen.getByText("1 RAD")).toBeInTheDocument();
    expect(screen.getByText("PV 12/12")).toBeInTheDocument();
    expect(screen.getByTestId("radiation-condition")).toHaveTextContent("Contaminado");
  });

  it("usa o pulso de 5 RAD e o botão de RadAway para remover radiação", async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).endsWith("/radiation") && init?.method === "POST") {
        const { delta } = JSON.parse(String(init?.body));
        return ok(radiationResponse(delta, delta < 0 ? 0 : 5));
      }
      if (String(url).endsWith("/ap")) return ok(apState(3, 2));
      return ok(roster);
    });

    await renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Pulso de 5 RAD" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Aumentar 5 de radiação" }));
    });

    expect(screen.getByTestId("radiation-feedback")).toHaveTextContent(
      "+5 RADS em 1 sobrevivente(s)",
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Reduzir 5 de radiação" }));
    });

    const posts = fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/radiation"));
    expect(JSON.parse(String(posts[1]?.[1]?.body)).delta).toBe(-5);
    expect(screen.getByTestId("radiation-feedback")).toHaveTextContent(
      "-5 RADS em 1 sobrevivente(s)",
    );
  });

  it("desabilita os pulsos sem alvos e permite escolher todos de novo", async () => {
    await renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Limpar" }));

    expect(screen.getByRole("button", { name: "Aumentar 1 de radiação" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reduzir 1 de radiação" })).toBeDisabled();
    expect(screen.getByText("0/1 alvos")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Todos" }));
    expect(screen.getByRole("button", { name: "Aumentar 1 de radiação" })).toBeEnabled();
    expect(screen.getByRole("checkbox", { name: "Selecionar Nora" })).toBeChecked();
  });

  it("mostra a condição derivada e o teto de PV cortado pela radiação", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes("/characters?campaignId=")) {
        return ok([{ ...roster[0], radiation: 7, hpCurrent: 6 }, ...roster.slice(1)]);
      }
      if (String(url).endsWith("/ap")) return ok(apState(3, 2));
      throw new Error(`fetch não previsto: ${url}`);
    });

    await renderPanel();

    // 7 de 13 = 54% do teto contaminado → Debilitado, +1 de Dificuldade.
    expect(screen.getByText("7 RAD")).toBeInTheDocument();
    expect(screen.getByText("PV 6/6")).toBeInTheDocument();
    expect(screen.getByTestId("radiation-condition")).toHaveTextContent("Debilitado");
    expect(screen.getByTestId("radiation-condition")).toHaveTextContent("+1D");
    expect(screen.getByText("54%")).toBeInTheDocument();
  });

  it("recebe a radiação aplicada por outra tela via socket", async () => {
    let live = roster.map((c) => ({ ...c }));
    fetchMock.mockImplementation(async (url: string) =>
      String(url).endsWith("/ap") ? ok(apState(3, 2)) : ok(live),
    );

    await renderPanel();

    const listener = socketMock.subscribeFalloutRadiationUpdate.mock.calls.at(-1)?.[0];

    await act(async () => {
      live = live.map((c) => (c.id === "char-nora" ? { ...c, radiation: 10, hpCurrent: 3 } : c));
      listener?.({
        campaignId: CAMPAIGN_ID,
        delta: 10,
        characters: radiationResponse(10, 10).updated,
      });
    });

    expect(screen.getByText("10 RAD")).toBeInTheDocument();
    expect(screen.getByText("77%")).toBeInTheDocument();
    expect(screen.getByTestId("radiation-condition")).toHaveTextContent("Crítico");
    expect(screen.getByTestId("radiation-condition")).toHaveTextContent("+2D");
  });

  it("avisa quando o servidor recusa a aplicação de radiação", async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).endsWith("/radiation") && init?.method === "POST") {
        return {
          ok: false,
          status: 403,
          json: async () => ({ success: false, error: "Apenas o Supervisor aplica radiação" }),
        };
      }
      if (String(url).endsWith("/ap")) return ok(apState(3, 2));
      return ok(roster);
    });

    await renderPanel();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Aumentar 1 de radiação" }));
    });

    expect(screen.getByTestId("radiation-feedback")).toHaveTextContent(
      "Apenas o Supervisor aplica radiação",
    );
    expect(socketMock.emitFalloutRadiationUpdate).not.toHaveBeenCalled();
  });

  it("ajusta o AP da Equipe pelo servidor e propaga no socket", async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).endsWith("/ap") && init?.method === "POST") return ok(apState(4, 2));
      if (String(url).endsWith("/ap")) return ok(apState(3, 2));
      return ok(roster);
    });

    await renderPanel();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Adicionar 1 AP à Equipe" }));
    });

    const post = fetchMock.mock.calls.find(
      ([url, init]) => String(url).endsWith("/ap") && (init as RequestInit)?.method === "POST",
    );
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ deltaParty: 1, deltaOverseer: 0 });
    expect(screen.getByTestId("card-party-ap")).toHaveTextContent("4/6");
    expect(socketMock.emitFalloutApUpdate).toHaveBeenCalledWith({
      campaignId: CAMPAIGN_ID,
      partyAP: 4,
      overseerAP: 2,
    });
  });

  it("gasta AP do Supervisor e bloqueia o pool da equipe no teto", async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).endsWith("/ap") && init?.method === "POST") return ok(apState(6, 1));
      if (String(url).endsWith("/ap")) return ok(apState(6, 2));
      return ok(roster);
    });

    await renderPanel("6/6");

    expect(screen.getByRole("button", { name: "Adicionar 1 AP à Equipe" })).toBeDisabled();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Gastar 1 AP do Supervisor" }));
    });

    const post = fetchMock.mock.calls.find(
      ([url, init]) => String(url).endsWith("/ap") && (init as RequestInit)?.method === "POST",
    );
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ deltaParty: 0, deltaOverseer: -1 });
    expect(screen.getByTestId("card-overseer-ap")).toHaveTextContent("1");
  });

  it("recolhe e reabre a lista de alvos recarregando o roster", async () => {
    await renderPanel();

    const toggle = screen.getByRole("button", { name: /Alvos/ });
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("checkbox", { name: "Selecionar Nora" })).not.toBeInTheDocument();

    const callsBefore = fetchMock.mock.calls.length;
    await act(async () => {
      fireEvent.click(toggle);
    });

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore);
    expect(screen.getByRole("checkbox", { name: "Selecionar Nora" })).toBeChecked();
  });
});
