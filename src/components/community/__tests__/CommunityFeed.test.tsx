import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import CommunityFeed from "../CommunityFeed";
import type { CommunityPost } from "../CommunityCard";

const mockPosts: CommunityPost[] = [
  {
    id: "post-1",
    authorId: "user-1",
    title: "Bola de Fogo Ancestral",
    description: "Uma magia devastadora de fogo arcano.",
    contentType: "spell",
    contentId: "spell-1",
    tags: ["fogo", "arcano"],
    payload: { name: "Bola de Fogo Ancestral", damage: "8d6" },
    clonesCount: 5,
    createdAt: "2026-03-01T12:00:00Z",
    updatedAt: "2026-03-01T12:00:00Z",
    author: {
      id: "user-1",
      displayName: "Mestre Supremo",
    },
    likesCount: 10,
    commentsCount: 2,
    isLikedByMe: false,
  },
  {
    id: "post-2",
    authorId: "user-2",
    title: "Espada Justiceira",
    description: "Uma lâmina sagrada forjada em prata.",
    contentType: "item",
    contentId: "item-1",
    tags: ["espada", "sagrado"],
    payload: { name: "Espada Justiceira" },
    clonesCount: 2,
    createdAt: "2026-03-02T15:00:00Z",
    updatedAt: "2026-03-02T15:00:00Z",
    author: {
      id: "user-2",
      displayName: "Ferreiro Real",
    },
    likesCount: 3,
    commentsCount: 0,
    isLikedByMe: true,
  },
];

describe("CommunityFeed Component", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("renderiza o estado inicial do feed com título/contador, botão de publicar e filtros", async () => {
    global.fetch = vi.fn().mockImplementation((url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.startsWith("/api/community/posts")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: mockPosts, page: 1, limit: 12 }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: [] }),
      });
    });

    render(<CommunityFeed />);

    // Botão de publicar criação
    expect(screen.getByRole("button", { name: /\+ Publicar Criação/i })).toBeInTheDocument();

    // Filtros de categoria
    expect(screen.getByRole("button", { name: /Todos/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Magias/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Itens/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Classes/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /NPCs/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mundos/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Campanhas/i })).toBeInTheDocument();

    // Campo de busca e ordenação
    expect(screen.getByPlaceholderText(/Buscar por palavras-chave/i)).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();

    // Aguarda carregar e exibe contagem
    await waitFor(() => {
      expect(screen.getByText(/criações compartilhadas/i)).toHaveTextContent(
        "Mostrando 2 criações compartilhadas"
      );
    });
  });

  it("exibe cards de postagem com dados mockados de /api/community/posts", async () => {
    global.fetch = vi.fn().mockImplementation((url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.startsWith("/api/community/posts")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: mockPosts, page: 1, limit: 12 }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: [] }),
      });
    });

    render(<CommunityFeed />);

    await waitFor(() => {
      expect(screen.getByText("Bola de Fogo Ancestral")).toBeInTheDocument();
      expect(screen.getByText("Espada Justiceira")).toBeInTheDocument();
    });

    expect(screen.getByText("Uma magia devastadora de fogo arcano.")).toBeInTheDocument();
    expect(screen.getByText("Uma lâmina sagrada forjada em prata.")).toBeInTheDocument();
    expect(screen.getByText("Mestre Supremo")).toBeInTheDocument();
    expect(screen.getByText("Ferreiro Real")).toBeInTheDocument();
    expect(screen.getByText("#fogo")).toBeInTheDocument();
    expect(screen.getByText("#espada")).toBeInTheDocument();
  });

  it("permite filtrar posts por categoria ao clicar em Magias ou Itens", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("type=spell")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [mockPosts[0]], page: 1, limit: 12 }),
        });
      }
      if (urlStr.includes("type=item")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [mockPosts[1]], page: 1, limit: 12 }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: mockPosts, page: 1, limit: 12 }),
      });
    });
    global.fetch = fetchMock;

    render(<CommunityFeed />);

    await waitFor(() => {
      expect(screen.getByText("Bola de Fogo Ancestral")).toBeInTheDocument();
      expect(screen.getByText("Espada Justiceira")).toBeInTheDocument();
    });

    // Clica no filtro de Magias
    const spellFilterBtn = screen.getByRole("button", { name: /Magias/i });
    fireEvent.click(spellFilterBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("type=spell"));
      expect(screen.getByText("Bola de Fogo Ancestral")).toBeInTheDocument();
      expect(screen.queryByText("Espada Justiceira")).not.toBeInTheDocument();
    });

    // Clica no filtro de Itens
    const itemFilterBtn = screen.getByRole("button", { name: /Itens/i });
    fireEvent.click(itemFilterBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("type=item"));
      expect(screen.getByText("Espada Justiceira")).toBeInTheDocument();
      expect(screen.queryByText("Bola de Fogo Ancestral")).not.toBeInTheDocument();
    });
  });

  it("alterna likes ao clicar no botão de curtir", async () => {
    global.fetch = vi.fn().mockImplementation((url: string | URL | Request, options?: RequestInit) => {
      const urlStr = url.toString();
      if (urlStr.startsWith("/api/community/posts?") || urlStr === "/api/community/posts") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [mockPosts[0]], page: 1, limit: 12 }),
        });
      }
      if (urlStr === `/api/community/posts/${mockPosts[0].id}/like` && options?.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ isLiked: true, likesCount: 11 }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: [] }),
      });
    });

    render(<CommunityFeed />);

    await waitFor(() => {
      expect(screen.getByText("Bola de Fogo Ancestral")).toBeInTheDocument();
    });

    // O post-1 tem 10 curtidas e isLikedByMe: false
    expect(screen.getByText("10")).toBeInTheDocument();

    const likeButton = screen.getAllByRole("button", { name: /curtidas/i })[0];
    fireEvent.click(likeButton);

    await waitFor(() => {
      expect(screen.getByText("11")).toBeInTheDocument();
    });
  });

  it("exibe o estado vazio quando não houver posts", async () => {
    global.fetch = vi.fn().mockImplementation((url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.startsWith("/api/community/posts")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [], page: 1, limit: 12 }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: [] }),
      });
    });

    render(<CommunityFeed />);

    await waitFor(() => {
      expect(screen.getByText("Nenhuma criação encontrada")).toBeInTheDocument();
      expect(
        screen.getByText(/Não encontramos publicações com esses filtros/i)
      ).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /\+ Criar Primeira Publicação/i })).toBeInTheDocument();
  });

  it("abre o modal de criação ao clicar em '+ Publicar Criação'", async () => {
    global.fetch = vi.fn().mockImplementation((url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.startsWith("/api/community/posts")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: mockPosts, page: 1, limit: 12 }),
        });
      }
      // Mock de endpoints para conteúdo quando o modal abre
      if (urlStr.startsWith("/api/content/spells")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [] }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: [] }),
      });
    });

    render(<CommunityFeed />);

    await waitFor(() => {
      expect(screen.getByText("Bola de Fogo Ancestral")).toBeInTheDocument();
    });

    const publishBtn = screen.getByRole("button", { name: /\+ Publicar Criação/i });
    fireEvent.click(publishBtn);

    await waitFor(() => {
      expect(screen.getByText("Publicar na Comunidade do Mestre")).toBeInTheDocument();
    });
  });
});
