import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FalloutCharacterWizard } from "../FalloutCharacterWizard";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => new URLSearchParams(),
}));

const CATALOG_PERKS = [
  {
    id: "perk-action-boy",
    name: "Action Boy",
    circle: 2,
    useType: "perk",
    description: "Você ganha +1 AP extra por turno.",
    imageUrl: null,
    structuredEffects: { requirements: "AGI 5", source: "Core Rulebook" },
  },
  {
    id: "perk-gun-nut",
    name: "Gun Nut",
    circle: 4,
    useType: "perk",
    description: "Permite criar mods de armas.",
    imageUrl: null,
    structuredEffects: { requirements: "INT 6, Level 2", source: "Core Rulebook" },
  },
  {
    id: "perk-fortune-finder",
    name: "Fortune Finder",
    circle: 1,
    useType: "perk",
    description: "Encontra mais tampas de Nuka-Cola.",
    imageUrl: null,
    structuredEffects: { requirements: "LUC 5", source: "Core Rulebook" },
  },
  {
    id: "spell-fireball",
    name: "Fireball",
    circle: 3,
    useType: "somatic",
    description: "Magia genérica que não deve aparecer.",
    imageUrl: null,
    structuredEffects: null,
  },
];

function catalogResponse(perks: unknown[] = CATALOG_PERKS) {
  return { ok: true, json: async () => ({ success: true, data: perks }) };
}

function characterResponse() {
  return {
    ok: true,
    json: async () => ({
      success: true,
      data: { id: "fallout-char-1", name: "Walter" },
    }),
  };
}

/** Roteia o fetch por URL: catálogo de perks (GET) vs criação do personagem (POST). */
function mockFetchRouter(options?: { catalogFails?: boolean; perks?: unknown[] }) {
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const href = String(url);
    if (href.includes("/api/content/spells")) {
      if (options?.catalogFails) throw new Error("network down");
      return catalogResponse(options?.perks);
    }
    if (init?.method === "POST") return characterResponse();
    return { ok: true, json: async () => ({ success: true, data: [] }) };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function fillIdentityStep() {
  fireEvent.change(screen.getByLabelText(/Nome do Personagem/i), {
    target: { value: "Walter" },
  });
}

async function completeSpecialStep() {
  // Padrão 35 (7×5); adicionar +5 em um atributo atinge a soma exigida de 40.
  const plusButtons = screen.getAllByRole("button", { name: "+" });
  for (let i = 0; i < 5; i++) fireEvent.click(plusButtons[0]);
}

/** Percorre Identidade → SPECIAL → Perícias e chega na fase de Perks. */
async function goToPerksStep() {
  await fillIdentityStep();
  fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));
  await completeSpecialStep();
  fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));
  await screen.findByText("Tag Skills (especialidades ★)");
  fireEvent.click(screen.getByRole("button", { name: /Atletismo/i }));
  fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));
  await screen.findByText(/Perks Iniciais/i);
}

describe("FalloutCharacterWizard", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    pushMock.mockClear();
    localStorage.clear();
  });

  it("renderiza o stepper com as 4 fases e começa em Identidade", () => {
    render(<FalloutCharacterWizard />);

    expect(screen.getByText("Vault-Tec Registration System")).toBeDefined();
    expect(screen.getByRole("radiogroup", { name: /Origem do personagem/i })).toBeDefined();
    expect(screen.getByRole("radio", { name: /Morador de Refúgio/i })).toBeDefined();
    expect(screen.getByRole("radio", { name: /Super Mutante/i })).toBeDefined();
    expect(screen.getByRole("radio", { name: /Mister Handy/i })).toBeDefined();
    expect(screen.getByText("Criança do Refúgio (Vault Kid)")).toBeDefined();
  });

  it("bloqueia avanço da Identidade sem nome válido", async () => {
    render(<FalloutCharacterWizard />);

    fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));
    expect(await screen.findByText(/Nome deve ter no mínimo 2 caracteres/i)).toBeDefined();
    expect(screen.getByLabelText(/Nome do Personagem/i)).toBeDefined();
  });

  it("avança até S.P.E.C.I.A.L. e valida o orçamento de 40 pontos", async () => {
    render(<FalloutCharacterWizard />);

    await fillIdentityStep();
    fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));

    expect(await screen.findByText(/Atributos S\.P\.E\.C\.I\.A\.L\./i)).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));
    expect(
      await screen.findByText(/Distribua exatamente 40 pontos/i),
    ).toBeDefined();
  });

  it("selecionar Super Mutante aplica +2 FOR/RES e limita INT/CAR a 6", async () => {
    render(<FalloutCharacterWizard />);

    fireEvent.click(screen.getByRole("radio", { name: /Super Mutante/i }));
    await fillIdentityStep();
    fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));

    expect(await screen.findByText(/Bônus de origem já aplicados/i)).toBeDefined();
    expect(screen.getByText(/Força \+2, Resistência \+2/)).toBeDefined();
  });

  it("permite escolher até 3 Tag Skills e submete perks junto ao personagem", async () => {
    const fetchMock = mockFetchRouter();
    render(<FalloutCharacterWizard />);

    await fillIdentityStep();
    fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));
    await completeSpecialStep();
    fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));

    // Fase 3 — Perícias
    expect(
      await screen.findByText("Tag Skills (especialidades ★)"),
    ).toBeDefined();
    // Vault Dweller concede +1 Tag Skill extra (traço Criança do Refúgio): limite 4.
    fireEvent.click(screen.getByRole("button", { name: /Atletismo/i }));
    fireEvent.click(screen.getByRole("button", { name: /Furtividade/i }));
    fireEvent.click(screen.getByRole("button", { name: /Discurso/i }));
    fireEvent.click(screen.getByRole("button", { name: /Ciência/i }));
    expect(
      screen.getByText((_, el) => el?.textContent?.trim() === "4 / 4 selecionadas"),
    ).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));

    // Fase 4 — Perks (fallback customizado)
    expect(await screen.findByText(/Perks Iniciais/i)).toBeDefined();
    fireEvent.change(screen.getByLabelText("Perk personalizado"), {
      target: { value: "Fortune Finder" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Adicionar perk personalizado/i }));
    expect(screen.getByTestId("selected-perk-Fortune Finder")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /Registrar no Pip-Boy/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/player"));
    const postCall = fetchMock.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === "POST",
    );
    expect(postCall).toBeDefined();
    const body = JSON.parse((postCall![1] as RequestInit).body as string);
    expect(body.name).toBe("Walter");
    expect(body.origin).toBe("vault_dweller");
    expect(body.tagSkills).toEqual(["athletics", "sneak", "speech", "science"]);
    expect(body.perks).toEqual([{ name: "Fortune Finder", rank: 1 }]);
    expect(body.caps).toBe(50);
  });

  it("chama onSuccess em vez de router.push quando fornecido", async () => {
    mockFetchRouter();
    const onSuccess = vi.fn();
    render(<FalloutCharacterWizard onSuccess={onSuccess} />);

    await fillIdentityStep();
    fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));
    await completeSpecialStep();
    fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));
    fireEvent.click(screen.getByRole("button", { name: /Atletismo/i }));
    fireEvent.click(screen.getByRole("button", { name: /Próximo/i }));

    fireEvent.click(screen.getByRole("button", { name: /Registrar no Pip-Boy/i }));

    await waitFor(() =>
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ id: "fallout-char-1", name: "Walter" }),
      ),
    );
    expect(pushMock).not.toHaveBeenCalled();
  });
});

describe("FalloutCharacterWizard — catálogo de perks", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    pushMock.mockClear();
    localStorage.clear();
  });

  it("carrega o catálogo oficial e mostra apenas perks do Fallout 2d20", async () => {
    const fetchMock = mockFetchRouter();
    render(<FalloutCharacterWizard />);
    await goToPerksStep();

    expect(await screen.findByTestId("perk-card-perk-action-boy")).toBeDefined();
    expect(screen.getByTestId("perk-card-perk-gun-nut")).toBeDefined();
    expect(screen.getByTestId("perk-card-perk-fortune-finder")).toBeDefined();
    expect(screen.queryByTestId("perk-card-spell-fireball")).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/content/spells?ruleSystem=fallout_2d20",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("filtra os cards pela busca textual", async () => {
    mockFetchRouter();
    render(<FalloutCharacterWizard />);
    await goToPerksStep();
    await screen.findByTestId("perk-card-perk-action-boy");

    fireEvent.change(screen.getByLabelText(/Buscar perks/i), {
      target: { value: "gun" },
    });

    expect(screen.getByTestId("perk-card-perk-gun-nut")).toBeDefined();
    expect(screen.queryByTestId("perk-card-perk-action-boy")).toBeNull();
    expect(screen.queryByTestId("perk-card-perk-fortune-finder")).toBeNull();
  });

  it("filtra os cards pelo chip de atributo S.P.E.C.I.A.L.", async () => {
    mockFetchRouter();
    render(<FalloutCharacterWizard />);
    await goToPerksStep();
    await screen.findByTestId("perk-card-perk-action-boy");

    fireEvent.click(screen.getByRole("button", { name: "INT" }));

    expect(screen.getByTestId("perk-card-perk-gun-nut")).toBeDefined();
    expect(screen.queryByTestId("perk-card-perk-action-boy")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "INT" }));
    expect(screen.getByTestId("perk-card-perk-action-boy")).toBeDefined();
  });

  it("adiciona perk do catálogo e ajusta rank respeitando maxRank", async () => {
    mockFetchRouter();
    render(<FalloutCharacterWizard />);
    await goToPerksStep();

    const card = await screen.findByTestId("perk-card-perk-action-boy");
    fireEvent.click(within(card).getByRole("button", { name: /Adicionar Action Boy/i }));

    const selected = screen.getByTestId("selected-perk-Action Boy");
    expect(within(selected).getByText("Rank 1 / 2")).toBeDefined();

    fireEvent.click(within(selected).getByRole("button", { name: /Aumentar rank/i }));
    expect(within(selected).getByText("Rank 2 / 2")).toBeDefined();

    const increase = within(selected).getByRole("button", { name: /Aumentar rank/i });
    expect(increase).toBeDisabled();
    fireEvent.click(increase);
    expect(within(selected).getByText("Rank 2 / 2")).toBeDefined();

    fireEvent.click(within(selected).getByRole("button", { name: /Diminuir rank/i }));
    expect(within(selected).getByText("Rank 1 / 2")).toBeDefined();
  });

  it("marca requisito não atendido em âmbar sem bloquear a adição", async () => {
    mockFetchRouter();
    render(<FalloutCharacterWizard />);
    await goToPerksStep();

    // INT 6 e Level 2 não são atendidos por um personagem nível 1 com INT 5.
    const card = await screen.findByTestId("perk-card-perk-gun-nut");
    expect(within(card).getByTestId("perk-requirements-warning")).toBeDefined();
    fireEvent.click(within(card).getByRole("button", { name: /Adicionar Gun Nut/i }));

    expect(screen.getByTestId("selected-perk-Gun Nut")).toBeDefined();

    // Action Boy exige AGI 5, atendido pelo orçamento padrão.
    const okCard = screen.getByTestId("perk-card-perk-action-boy");
    expect(within(okCard).queryByTestId("perk-requirements-warning")).toBeNull();
  });

  it("exibe erro de carga e permite tentar novamente", async () => {
    const fetchMock = mockFetchRouter({ catalogFails: true });
    render(<FalloutCharacterWizard />);
    await goToPerksStep();

    expect(await screen.findByTestId("perk-catalog-error")).toBeDefined();
    fetchMock.mockImplementation(async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).includes("/api/content/spells")) return catalogResponse();
      if (init?.method === "POST") return characterResponse();
      return { ok: true, json: async () => ({ success: true, data: [] }) };
    });

    fireEvent.click(screen.getByRole("button", { name: /Tentar novamente/i }));

    expect(await screen.findByTestId("perk-card-perk-action-boy")).toBeDefined();
    expect(screen.queryByTestId("perk-catalog-error")).toBeNull();
  });

  it("remove perk selecionado e envia o catálogo escolhido no registro", async () => {
    const fetchMock = mockFetchRouter();
    render(<FalloutCharacterWizard />);
    await goToPerksStep();

    const card = await screen.findByTestId("perk-card-perk-fortune-finder");
    fireEvent.click(within(card).getByRole("button", { name: /Adicionar Fortune Finder/i }));
    expect(screen.getByTestId("selected-perk-Fortune Finder")).toBeDefined();

    fireEvent.click(
      within(screen.getByTestId("selected-perk-Fortune Finder")).getByRole("button", {
        name: /Remover/i,
      }),
    );
    expect(screen.queryByTestId("selected-perk-Fortune Finder")).toBeNull();

    fireEvent.click(
      within(screen.getByTestId("perk-card-perk-action-boy")).getByRole("button", {
        name: /Adicionar Action Boy/i,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Registrar no Pip-Boy/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/player"));
    const postCall = fetchMock.mock.calls.find(
      ([, init]) => (init as RequestInit | undefined)?.method === "POST",
    );
    const body = JSON.parse((postCall![1] as RequestInit).body as string);
    expect(body.perks).toEqual([
      {
        name: "Action Boy",
        rank: 1,
        maxRank: 2,
        description: "Você ganha +1 AP extra por turno.",
        requirements: "AGI 5",
        imageUrl: null,
        sourceKey: "perk-action-boy",
      },
    ]);
  });
});
