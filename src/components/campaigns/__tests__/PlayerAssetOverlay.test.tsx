import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PlayerAssetOverlay } from "../PlayerAssetOverlay";
import { useSocket } from "@/context/SocketContext";

vi.mock("@/context/SocketContext", () => ({
  useSocket: vi.fn(),
}));

describe("PlayerAssetOverlay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("não renderiza nada quando activeAsset é null", () => {
    vi.mocked(useSocket).mockReturnValue({
      activeAsset: null,
    } as any);

    const { container } = render(<PlayerAssetOverlay />);
    expect(container.firstChild).toBeNull();
  });

  it("renderiza imagem, nome e descrição quando activeAsset está ativo no socket", () => {
    vi.mocked(useSocket).mockReturnValue({
      activeAsset: {
        id: "asset-1",
        campaignId: "c1",
        name: "Carta Antiga do Rei",
        description: "Contém o selo real intocado.",
        imageUrl: "https://example.com/letter.png",
        category: "handout",
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    } as any);

    render(<PlayerAssetOverlay />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Carta Antiga do Rei")).toBeInTheDocument();
    expect(screen.getByText("Contém o selo real intocado.")).toBeInTheDocument();

    const img = screen.getByRole("img", { name: "Carta Antiga do Rei" });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://example.com/letter.png");
  });

  it("minimiza em chip flutuante ao clicar em minimizar", () => {
    vi.mocked(useSocket).mockReturnValue({
      activeAsset: {
        id: "asset-1",
        campaignId: "c1",
        name: "Mapa das Catacumbas",
        description: null,
        imageUrl: "https://example.com/catacombs.png",
        category: "map",
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    } as any);

    render(<PlayerAssetOverlay />);

    // Inicialmente aberto no modal dialog
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Clica no botão minimizar
    const minimizeBtn = screen.getByRole("button", { name: /minimizar/i });
    fireEvent.click(minimizeBtn);

    // O dialog não está mais visível
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // O chip flutuante aparece
    expect(screen.getByRole("complementary")).toBeInTheDocument();
    expect(screen.getByText(/Handout Ativo: Mapa das Catacumbas/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /expandir/i })).toBeInTheDocument();
  });

  it("re-expande ao clicar no chip ou no botão Expandir", () => {
    vi.mocked(useSocket).mockReturnValue({
      activeAsset: {
        id: "asset-1",
        campaignId: "c1",
        name: "Ilustração do Dragão",
        description: "Um dragão ancestral voando.",
        imageUrl: "https://example.com/dragon.png",
        category: "illustration",
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    } as any);

    render(<PlayerAssetOverlay />);

    // Minimiza
    fireEvent.click(screen.getByRole("button", { name: /minimizar/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Re-expande clicando no botão Expandir
    const expandBtn = screen.getByRole("button", { name: /expandir/i });
    fireEvent.click(expandBtn);

    // Dialog é reexibido
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Ilustração do Dragão")).toBeInTheDocument();
  });
});
