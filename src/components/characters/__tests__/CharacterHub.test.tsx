import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CharacterHub } from "../CharacterHub";

const { patchSpy } = vi.hoisted(() => ({ patchSpy: vi.fn() }));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "char-1" }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

vi.mock("@/components/characters/ShareLink", () => ({
  ShareLink: () => <div data-testid="mock-share-link" />,
}));

const ownerHub = {
  success: true,
  data: {
    id: "char-1",
    ownerId: "user-1",
    isOwner: true,
    name: "Artemis",
    imageUrl: "https://cdn.libmork.dev/artemis.png",
    description: "Caçadora das sombras de Barovia.",
    level: 5,
    xp: 42,
    xpToNextLevel: 100,
    raceName: "Elfa",
    className: "Ladina",
    activeSession: {
      sessionId: "s-1",
      campaignId: "c-1",
      campaignName: "Strahd",
      scheduledAt: new Date().toISOString(),
    },
  },
};

let hubResponse: unknown = ownerHub;

function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/hub")) {
        return Promise.resolve({ ok: true, json: async () => hubResponse });
      }
      if (init?.method === "PATCH") {
        patchSpy(url, init);
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: {} }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: {} }) });
    }),
  );
}

describe("CharacterHub (Issue #79)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hubResponse = ownerHub;
    stubFetch();
  });

  afterEach(() => vi.unstubAllGlobals());

  it("renderiza hero com identidade, XP, biografia e link da ficha", async () => {
    render(<CharacterHub />);
    expect(await screen.findByText("Artemis")).toBeInTheDocument();
    expect(screen.getByText("Elfa")).toBeInTheDocument();
    expect(screen.getByText("Ladina")).toBeInTheDocument();
    expect(screen.getByText(/Nível 5/)).toBeInTheDocument();
    expect(screen.getByText("42 / 100 XP")).toBeInTheDocument();
    expect(screen.getByText("Caçadora das sombras de Barovia.")).toBeInTheDocument();

    const sheetLink = screen.getByTestId("ver-ficha-link");
    expect(sheetLink).toHaveAttribute("href", "/player/characters/char-1/sheet");
  });

  it("mostra badge de sessão ativa com deep-link para a campanha", async () => {
    render(<CharacterHub />);
    const badge = await screen.findByTestId("session-active-link");
    expect(badge).toHaveTextContent(/Sessão Ativa/);
    expect(badge).toHaveAttribute("href", "/player?tab=campaigns&campaign=c-1");
  });

  it("dono vê compartilhar e edita a biografia via PATCH", async () => {
    render(<CharacterHub />);
    expect(await screen.findByTestId("mock-share-link")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("edit-bio-button"));
    const textarea = screen.getByTestId("bio-textarea");
    fireEvent.change(textarea, { target: { value: "Nova biografia da Artemis." } });
    fireEvent.click(screen.getByTestId("save-bio-button"));

    await waitFor(() => expect(patchSpy).toHaveBeenCalled());
    const [url, init] = patchSpy.mock.calls[0];
    expect(url).toBe("/api/characters/char-1");
    expect(JSON.parse(init.body as string)).toEqual({ description: "Nova biografia da Artemis." });
  });

  it("visitante não vê compartilhar nem edição de biografia", async () => {
    hubResponse = {
      ...ownerHub,
      data: { ...ownerHub.data, isOwner: false, activeSession: null },
    };
    render(<CharacterHub />);
    await screen.findByText("Artemis");
    expect(screen.queryByTestId("mock-share-link")).not.toBeInTheDocument();
    expect(screen.queryByTestId("edit-bio-button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("session-active-link")).not.toBeInTheDocument();
  });
});
