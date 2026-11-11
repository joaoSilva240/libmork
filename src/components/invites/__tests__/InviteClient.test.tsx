import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { InviteClient } from "../InviteClient";
import type { PublicInvite } from "@/lib/server/public-invite";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const fetchCalls: string[] = [];

function jsonResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    text: async () => JSON.stringify({ data }),
  };
}

function mockFetchForSystem(system: "fallout" | "missing" | "d20", payload: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      fetchCalls.push(url);
      if (url.includes("/api/auth/me")) {
        return Promise.resolve(
          jsonResponse({ id: "user-1", email: "a@b.c", displayName: "Player", role: "player" }),
        );
      }
      if (system === "fallout" && url.includes("/api/systems/fallout/characters")) {
        return Promise.resolve(jsonResponse(payload));
      }
      if (system === "missing" && url.includes("/api/systems/missing/habitants")) {
        return Promise.resolve(jsonResponse(payload));
      }
      if (system === "d20" && url.includes("/api/characters")) {
        return Promise.resolve(jsonResponse(payload));
      }
      return Promise.resolve(jsonResponse(null, false, 404));
    }),
  );
}

function makeInvite(rulesEngine: string, campaignId = "camp-1"): PublicInvite {
  return { campaignId, campaignName: "Campanha Teste", rulesEngine, pvpEnabled: false };
}

describe("InviteClient — filtro por sistema e redirect de criação", () => {
  beforeEach(() => {
    fetchCalls.length = 0;
    mockPush.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("campanha Fallout: carrega sobreviventes e direciona criação ao sistema Fallout", async () => {
    mockFetchForSystem("fallout", []);
    render(<InviteClient invite={makeInvite("fallout_2d20", "camp-f")} token="tok" />);

    const createLink = await screen.findByRole("link", { name: /Criar Sobrevivente/i });
    expect(createLink).toHaveAttribute(
      "href",
      "/player/characters/new?system=fallout_2d20&campaignId=camp-f",
    );
    expect(screen.getByText(/Fallout 2d20/)).toBeInTheDocument();
    expect(fetchCalls.some((u) => u.includes("/api/systems/fallout/characters"))).toBe(true);
    expect(fetchCalls.some((u) => u.endsWith("/api/characters"))).toBe(false);
  });

  it("campanha Fallout: lista apenas sobreviventes de fora desta campanha", async () => {
    mockFetchForSystem("fallout", [
      { id: "fc-1", name: "Cooper Howard", campaignId: null, level: 3, origin: "ghoul" },
      { id: "fc-2", name: "Já Vinculado", campaignId: "camp-f", level: 2, origin: "human" },
    ]);
    render(<InviteClient invite={makeInvite("fallout_2d20", "camp-f")} token="tok" />);

    await waitFor(() => {
      expect(screen.getByText(/Cooper Howard/)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Já Vinculado/)).toBeNull();
  });

  it("campanha MISSING: carrega habitantes e direciona criação ao sistema MISSING", async () => {
    mockFetchForSystem("missing", []);
    render(<InviteClient invite={makeInvite("missing_zero", "camp-m")} token="tok" />);

    const createLink = await screen.findByRole("link", { name: /Criar Habitante/i });
    expect(createLink).toHaveAttribute(
      "href",
      "/player/characters/new?system=missing_zero&campaignId=camp-m",
    );
    expect(fetchCalls.some((u) => u.includes("/api/systems/missing/habitants"))).toBe(true);
  });

  it("campanha d20: carrega personagens clássicos e direciona criação ao Libmork", async () => {
    mockFetchForSystem("d20", []);
    render(<InviteClient invite={makeInvite("d20_mod", "camp-d")} token="tok" />);

    const createLink = await screen.findByRole("link", { name: /Criar Personagem/i });
    expect(createLink).toHaveAttribute(
      "href",
      "/player/characters/new?system=libmork&campaignId=camp-d",
    );
    expect(fetchCalls.some((u) => u.endsWith("/api/characters"))).toBe(true);
  });
});