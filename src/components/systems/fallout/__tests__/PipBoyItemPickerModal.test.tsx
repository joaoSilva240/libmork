import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PipBoyItemPickerModal } from "../PipBoyItemPickerModal";
import type { FalloutItem } from "@/lib/systems/fallout/types";

/** Linhas reais da tabela `items`: os campos do Foundry ficam em `sourceData`. */
const CATALOG_ITEMS = [
  {
    id: "item-10mm",
    name: "10mm Pistol",
    description: "Pistola semiautomática confiável.",
    qualityDescription: "Cost: 50 caps • Weight: 4",
    imageUrl: null,
    sourceKey: "fallout:weapons:10mm_pistol",
    sourceData: {
      pack: "weapons",
      weight: 4,
      cost: 50,
      ammo: "10mm Round",
      ammoPerShot: 1,
      fireRate: 2,
      range: "close",
      damage: {
        rating: 4,
        damageType: { physical: true, energy: false, radiation: false, poison: false },
        damageEffect: { piercing_x: { rank: 1, value: 0 } },
        weaponQuality: { reliable: { rank: 0, value: 1 } },
      },
    },
  },
  {
    id: "item-armor",
    name: "Combat Armor",
    description: "Armadura padrão militar.",
    qualityDescription: null,
    imageUrl: null,
    sourceKey: "fallout:apparel:combat_armor",
    sourceData: {
      pack: "apparel",
      apparelType: "armor",
      weight: 20,
      cost: 185,
      location: { head: true, torso: true, armL: true, armR: true, legL: true, legR: true },
      resistance: { physical: 2, energy: 2, radiation: 0 },
    },
  },
  {
    id: "item-nuka",
    name: "Nuka-Cola",
    description: "Refrigerante pré-guerra.",
    qualityDescription: null,
    imageUrl: null,
    sourceKey: "fallout:consumables:nuka_cola",
    sourceData: { pack: "consumables", consumableType: "beverage", hp: 2, quantity: 1, weight: 1, cost: 20 },
  },
  {
    id: "item-ammo",
    name: "10mm Round",
    description: "Munição de pistola.",
    qualityDescription: null,
    imageUrl: null,
    sourceKey: "fallout:ammunition:10mm_round",
    sourceData: { pack: "ammunition", quantity: 10, weight: 0.1, cost: 2 },
  },
];

function catalogResponse(items: unknown[] = CATALOG_ITEMS) {
  return { ok: true, json: async () => ({ success: true, data: items }) };
}

function mockFetchRouter(options?: { catalogFails?: boolean }) {
  const fetchMock = vi.fn(async (url: string | URL | Request) => {
    if (String(url).includes("/api/content/items")) {
      if (options?.catalogFails) throw new Error("network down");
      return catalogResponse();
    }
    return { ok: true, json: async () => ({ success: true, data: [] }) };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderModal(onSelect = vi.fn()) {
  const onClose = vi.fn();
  render(<PipBoyItemPickerModal isOpen onClose={onClose} onSelect={onSelect} />);
  return { onSelect, onClose };
}

describe("PipBoyItemPickerModal", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("não renderiza o diálogo quando fechado", () => {
    mockFetchRouter();
    render(<PipBoyItemPickerModal isOpen={false} onClose={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("carrega o catálogo de itens da Biblioteca Global", async () => {
    const fetchMock = mockFetchRouter();
    renderModal();

    expect(
      screen.getByRole("dialog", { name: "Seletor de Itens Pip-Boy" }),
    ).toBeInTheDocument();
    expect(await screen.findByTestId("item-card-item-10mm")).toBeInTheDocument();
    expect(screen.getByTestId("item-card-item-armor")).toBeInTheDocument();
    expect(screen.getByTestId("item-card-item-nuka")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/content/items?ruleSystem=fallout_2d20",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("filtra os cards pela busca textual", async () => {
    mockFetchRouter();
    renderModal();
    await screen.findByTestId("item-card-item-10mm");

    fireEvent.change(screen.getByLabelText(/Buscar itens/i), { target: { value: "combat" } });

    expect(screen.getByTestId("item-card-item-armor")).toBeInTheDocument();
    expect(screen.queryByTestId("item-card-item-10mm")).toBeNull();
    expect(screen.queryByTestId("item-card-item-nuka")).toBeNull();
  });

  it("filtra os cards pelo chip de categoria", async () => {
    mockFetchRouter();
    renderModal();
    await screen.findByTestId("item-card-item-10mm");

    fireEvent.click(screen.getByRole("button", { name: "Armas" }));
    expect(screen.getByTestId("item-card-item-10mm")).toBeInTheDocument();
    expect(screen.queryByTestId("item-card-item-armor")).toBeNull();
    expect(screen.queryByTestId("item-card-item-nuka")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Vestuário" }));
    expect(screen.getByTestId("item-card-item-armor")).toBeInTheDocument();
    expect(screen.queryByTestId("item-card-item-10mm")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Vestuário" }));
    expect(screen.getByTestId("item-card-item-10mm")).toBeInTheDocument();
  });

  it("mostra peso e caps no card", async () => {
    mockFetchRouter();
    renderModal();
    const card = await screen.findByTestId("item-card-item-10mm");
    expect(within(card).getByText(/4 lbs/)).toBeInTheDocument();
    expect(within(card).getByText(/50 Tampas/)).toBeInTheDocument();
  });

  it("entrega o item estruturado (arma) ao selecionar", async () => {
    mockFetchRouter();
    const { onSelect } = renderModal();

    const card = await screen.findByTestId("item-card-item-10mm");
    fireEvent.click(within(card).getByRole("button", { name: /Adicionar 10mm Pistol/i }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    const item = onSelect.mock.calls[0][0] as FalloutItem;
    expect(item.type).toBe("weapon");
    expect(item.name).toBe("10mm Pistol");
    expect(item.weight).toBe(4);
    expect(item.costCaps).toBe(50);
    if (item.type === "weapon") {
      expect(item.damageDiceRating).toBe(4);
      expect(item.qualities).toEqual(["reliable"]);
    }
  });

  it("entrega o item estruturado (armadura) ao selecionar", async () => {
    mockFetchRouter();
    const { onSelect } = renderModal();

    const card = await screen.findByTestId("item-card-item-armor");
    fireEvent.click(within(card).getByRole("button", { name: /Adicionar Combat Armor/i }));

    const item = onSelect.mock.calls[0][0] as FalloutItem;
    expect(item.type).toBe("apparel");
    if (item.type === "apparel") {
      expect(item.resistances.physical).toBe(2);
      expect(item.locationsCovered).toHaveLength(6);
    }
  });

  it("exibe erro de carga e permite tentar novamente", async () => {
    const fetchMock = mockFetchRouter({ catalogFails: true });
    renderModal();

    expect(await screen.findByTestId("item-catalog-error")).toBeInTheDocument();
    fetchMock.mockImplementation(async () => catalogResponse());

    fireEvent.click(screen.getByRole("button", { name: /Tentar novamente/i }));

    expect(await screen.findByTestId("item-card-item-10mm")).toBeInTheDocument();
    expect(screen.queryByTestId("item-catalog-error")).toBeNull();
  });

  it("fecha o seletor pelo botão Fechar", async () => {
    mockFetchRouter();
    const { onClose } = renderModal();
    await screen.findByTestId("item-card-item-10mm");

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
