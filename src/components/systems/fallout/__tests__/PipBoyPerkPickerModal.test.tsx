import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PipBoyPerkPickerModal } from "../PipBoyPerkPickerModal";
import { createInitialFalloutCharacter } from "@/lib/systems/fallout/rules";
import type { FalloutCharacterPerk } from "@/lib/systems/fallout/types";

/** Payload real do compendio: `requirements` vem null e a exigencia fica em `requirementsEx`. */
function requirementsEx(attributes: Record<string, number>, level = 1) {
  return {
    attributes: Object.fromEntries(
      ["str", "per", "end", "cha", "int", "agi", "luc"].map((key) => [
        key,
        { value: attributes[key] ?? 0 },
      ]),
    ),
    level,
  };
}

const CATALOG_PERKS = [
  {
    id: "perk-action-boy",
    name: "Action Boy",
    circle: 1,
    useType: "perk",
    description: "Você ganha +1 AP extra por turno.",
    imageUrl: null,
    structuredEffects: {
      requirements: null,
      requirementsEx: requirementsEx({}, 1),
      source: "Core Rulebook",
    },
  },
  {
    id: "perk-gun-nut",
    name: "Gun Nut",
    circle: 4,
    useType: "perk",
    description: "Permite criar mods de armas.",
    imageUrl: null,
    structuredEffects: {
      requirements: null,
      requirementsEx: requirementsEx({ int: 6 }, 2),
      source: "Core Rulebook",
    },
  },
  {
    id: "perk-fortune-finder",
    name: "Fortune Finder",
    circle: 3,
    useType: "perk",
    description: "Encontra mais tampas de Nuka-Cola.",
    imageUrl: null,
    structuredEffects: {
      requirements: null,
      requirementsEx: requirementsEx({ luc: 5 }, 2),
      source: "Core Rulebook",
    },
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

function mockFetchRouter(options?: { catalogFails?: boolean }) {
  const fetchMock = vi.fn(async (url: string | URL | Request) => {
    if (String(url).includes("/api/content/spells")) {
      if (options?.catalogFails) throw new Error("network down");
      return catalogResponse();
    }
    return { ok: true, json: async () => ({ success: true, data: [] }) };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Personagem nível 3 com INT 5 e o perk legado "Action Boy" já registrado. */
function buildCharacter() {
  return createInitialFalloutCharacter(
    {
      name: "Cooper Howard",
      origin: "ghoul",
      level: 3,
      xp: 0,
      attributes: { str: 6, per: 8, end: 7, cha: 5, int: 5, agi: 9, luc: 6 },
      tagSkills: ["small_guns"],
      perks: ["Action Boy"],
      caps: 250,
    },
    "user-1",
    "char-cooper",
  );
}

function renderModal(onSelect = vi.fn()) {
  const onClose = vi.fn();
  render(
    <PipBoyPerkPickerModal
      isOpen
      onClose={onClose}
      character={buildCharacter()}
      onSelect={onSelect}
    />,
  );
  return { onSelect, onClose };
}

describe("PipBoyPerkPickerModal", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("não renderiza o diálogo quando fechado", () => {
    mockFetchRouter();
    render(
      <PipBoyPerkPickerModal
        isOpen={false}
        onClose={vi.fn()}
        character={buildCharacter()}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("carrega o catálogo oficial e mostra apenas perks do Fallout 2d20", async () => {
    const fetchMock = mockFetchRouter();
    renderModal();

    expect(
      screen.getByRole("dialog", { name: "Seletor de Perks Pip-Boy" }),
    ).toBeInTheDocument();
    expect(await screen.findByTestId("perk-card-perk-action-boy")).toBeInTheDocument();
    expect(screen.getByTestId("perk-card-perk-fortune-finder")).toBeInTheDocument();
    // Gun Nut bloqueada (INT 6 > 5) oculta por default
    expect(screen.queryByTestId("perk-card-perk-gun-nut")).toBeNull();
    fireEvent.click(screen.getByLabelText(/Mostrar perks bloqueadas/));
    expect(screen.getByTestId("perk-card-perk-gun-nut")).toBeInTheDocument();
    expect(screen.queryByTestId("perk-card-spell-fireball")).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/content/spells?ruleSystem=fallout_2d20",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("filtra os cards pela busca textual", async () => {
    mockFetchRouter();
    renderModal();
    await screen.findByTestId("perk-card-perk-action-boy");
    fireEvent.click(screen.getByLabelText(/Mostrar perks bloqueadas/));

    fireEvent.change(screen.getByLabelText(/Buscar perks/i), { target: { value: "gun" } });

    expect(screen.getByTestId("perk-card-perk-gun-nut")).toBeInTheDocument();
    expect(screen.queryByTestId("perk-card-perk-action-boy")).toBeNull();
    expect(screen.queryByTestId("perk-card-perk-fortune-finder")).toBeNull();
  });

  it("filtra os cards pelo chip de atributo S.P.E.C.I.A.L.", async () => {
    mockFetchRouter();
    renderModal();
    await screen.findByTestId("perk-card-perk-action-boy");
    fireEvent.click(screen.getByLabelText(/Mostrar perks bloqueadas/));

    fireEvent.click(screen.getByRole("button", { name: "INT" }));
    expect(screen.getByTestId("perk-card-perk-gun-nut")).toBeInTheDocument();
    expect(screen.queryByTestId("perk-card-perk-fortune-finder")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "INT" }));
    expect(screen.getByTestId("perk-card-perk-fortune-finder")).toBeInTheDocument();
  });

  it("avalia requisitos contra o personagem e bloqueia a adição", async () => {
    mockFetchRouter();
    renderModal();
    fireEvent.click(screen.getByLabelText(/Mostrar perks bloqueadas/));

    // Gun Nut exige INT 6 e Nível 2: o personagem tem INT 5 (bloqueado).
    const card = await screen.findByTestId("perk-card-perk-gun-nut");
    expect(within(card).getByText("INT 6, Nível 2")).toBeInTheDocument();
    expect(within(card).getByTestId("perk-requirements-warning")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: /Adicionar Gun Nut/i })).toBeDisabled();

    // Fortune Finder exige SOR 5 e Nível 2: SOR 6 e nível 3 atendem.
    const luckCard = screen.getByTestId("perk-card-perk-fortune-finder");
    expect(within(luckCard).getByText("SOR 5, Nível 2")).toBeInTheDocument();
    expect(within(luckCard).queryByTestId("perk-requirements-warning")).toBeNull();
  });

  it("desabilita perks que o personagem já possui (inclusive string legada)", async () => {
    mockFetchRouter();
    renderModal();

    const card = await screen.findByTestId("perk-card-perk-action-boy");
    expect(within(card).getByRole("button", { name: /Adicionar Action Boy/i })).toBeDisabled();
    expect(within(card).getByText("Já possui")).toBeInTheDocument();

    const free = screen.getByTestId("perk-card-perk-fortune-finder");
    expect(within(free).getByRole("button", { name: /Adicionar Fortune Finder/i })).toBeEnabled();
  });

  it("entrega o perk estruturado do catálogo ao selecionar", async () => {
    mockFetchRouter();
    const { onSelect } = renderModal();

    const card = await screen.findByTestId("perk-card-perk-fortune-finder");
    fireEvent.click(within(card).getByRole("button", { name: /Adicionar Fortune Finder/i }));

    expect(onSelect).toHaveBeenCalledWith({
      name: "Fortune Finder",
      rank: 1,
      maxRank: 3,
      description: "Encontra mais tampas de Nuka-Cola.",
      requirements: "SOR 5, Nível 2",
      imageUrl: null,
      sourceKey: "perk-fortune-finder",
    } satisfies FalloutCharacterPerk);
  });

  it("exibe erro de carga e permite tentar novamente", async () => {
    const fetchMock = mockFetchRouter({ catalogFails: true });
    renderModal();

    expect(await screen.findByTestId("perk-catalog-error")).toBeInTheDocument();
    fetchMock.mockImplementation(async () => catalogResponse());

    fireEvent.click(screen.getByRole("button", { name: /Tentar novamente/i }));

    expect(await screen.findByTestId("perk-card-perk-action-boy")).toBeInTheDocument();
    expect(screen.queryByTestId("perk-catalog-error")).toBeNull();
  });

  it("fecha o seletor pelo botão Fechar", async () => {
    mockFetchRouter();
    const { onClose } = renderModal();
    await screen.findByTestId("perk-card-perk-action-boy");

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
