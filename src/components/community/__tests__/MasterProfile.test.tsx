import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import MasterProfile, { MasterProfileData } from "../MasterProfile";

const mockProfile: MasterProfileData = {
  id: "user-123",
  displayName: "mestre_gandalf",
  masterName: "Gandalf, o Cinzento",
  masterAvatar: "https://example.com/avatar.jpg",
  masterBio: "Um mago nunca se atrasa, nem se adianta.",
  masterBannerUrl: "https://example.com/banner.jpg",
  statistics: {
    campaigns: 5,
    sessions: 42,
    spells: 12,
    items: 8,
    classes: 2,
    npcs: 15,
    worlds: 3,
  },
};

const mockPosts = [
  {
    id: "post-1",
    authorId: "user-123",
    title: "Chama de Anor",
    description: "Uma magia arcana poderosa.",
    contentType: "spell",
    tags: ["fogo", "luz"],
    payload: { name: "Chama de Anor" },
    clonesCount: 7,
    createdAt: "2026-03-01T12:00:00Z",
    updatedAt: "2026-03-01T12:00:00Z",
    author: {
      id: "user-123",
      displayName: "mestre_gandalf",
      masterName: "Gandalf, o Cinzento",
      masterAvatar: "https://example.com/avatar.jpg",
    },
    likesCount: 20,
    commentsCount: 4,
    isLikedByMe: false,
  },
];

describe("MasterProfile Component", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("renderiza o perfil do mestre com dados, bio e badges de estatísticas", async () => {
    global.fetch = vi.fn().mockImplementation((url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("/api/community/profile/user-123/posts")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: mockPosts, page: 1, limit: 20 }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ profile: mockProfile, data: [] }),
      });
    });

    render(
      <MasterProfile
        userId="user-123"
        profileData={mockProfile}
        currentUserId="user-other"
      />
    );

    // Nome de Mestre e Handle
    expect(screen.getByText("Gandalf, o Cinzento")).toBeInTheDocument();
    expect(screen.getByText("@mestre_gandalf")).toBeInTheDocument();
    expect(
      screen.getByText("Um mago nunca se atrasa, nem se adianta.")
    ).toBeInTheDocument();

    // Badges de estatísticas
    expect(screen.getByText("Campanhas")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Magias")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Itens")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("Mundos")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();

    // Botão de editar NÃO deve aparecer para outro usuário
    expect(screen.queryByRole("button", { name: /editar perfil/i })).not.toBeInTheDocument();

    // Post carregado no feed
    await waitFor(() => {
      expect(screen.getByText("Chama de Anor")).toBeInTheDocument();
    });
  });

  it("exibe o botão 'Editar Perfil' quando o usuário autenticado for o dono", () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    render(
      <MasterProfile
        userId="user-123"
        profileData={mockProfile}
        currentUserId="user-123"
      />
    );

    const editBtn = screen.getByRole("button", { name: /editar perfil/i });
    expect(editBtn).toBeInTheDocument();

    // Clica no botão e abre o modal de edição
    fireEvent.click(editBtn);
    expect(screen.getByText("Editar Perfil de Mestre")).toBeInTheDocument();
  });

  it("permite alternar entre as abas 'Publicações', 'Clonados' e 'Curtidos'", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("/cloned")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: [
              {
                ...mockPosts[0],
                id: "post-cloned",
                title: "Post Clonado pelo Usuário",
              },
            ],
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: mockPosts }),
      });
    });

    global.fetch = fetchMock;

    render(
      <MasterProfile
        userId="user-123"
        profileData={mockProfile}
        currentUserId="user-123"
      />
    );

    // Clica na tab "Clonados"
    const clonedTab = screen.getByRole("button", { name: "Clonados" });
    fireEvent.click(clonedTab);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/community/profile/user-123/cloned")
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Post Clonado pelo Usuário")).toBeInTheDocument();
    });
  });

  it("renderiza mensagem amigável quando a aba não possui publicações", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    render(
      <MasterProfile
        userId="user-123"
        profileData={mockProfile}
        currentUserId="user-123"
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText("Nenhuma publicação criada por este mestre.")
      ).toBeInTheDocument();
    });
  });
});
