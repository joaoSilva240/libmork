import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MasterSidebar } from "../MasterSidebar";

const mockUsePathname = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

describe("MasterSidebar Component", () => {
  it("renders navigation items including 'Configurações' with active state", () => {
    mockUsePathname.mockReturnValue("/master/settings");

    render(<MasterSidebar />);

    expect(screen.getByText("Campanhas")).toBeInTheDocument();
    expect(screen.getByText("Biblioteca")).toBeInTheDocument();
    expect(screen.getByText("Comunidade")).toBeInTheDocument();
    expect(screen.getByText("Configurações")).toBeInTheDocument();

    // Verifica que "Meu Perfil" não está mais presente
    expect(screen.queryByText("Meu Perfil")).not.toBeInTheDocument();

    const settingsLink = screen.getByRole("link", { name: /configurações/i });
    expect(settingsLink).toHaveAttribute("href", "/master/settings");
    expect(settingsLink).toHaveClass("bg-gray-800", "text-white");
  });

  it("renders 'Comunidade' link with correct href", () => {
    mockUsePathname.mockReturnValue("/master/community");

    render(<MasterSidebar />);

    const communityLink = screen.getByRole("link", { name: /comunidade/i });
    expect(communityLink).toHaveAttribute("href", "/master/community");
    expect(communityLink).toHaveClass("bg-gray-800", "text-white");
  });

  it("renders accessible navigation links and lucide-react icons in expanded and collapsed states", () => {
    mockUsePathname.mockReturnValue("/master");

    const { rerender } = render(<MasterSidebar />);

    const links = screen.getAllByRole("link");
    const campaignsLink = screen.getByRole("link", { name: "Campanhas" });
    const libraryLink = screen.getByRole("link", { name: "Biblioteca" });
    const communityLink = screen.getByRole("link", { name: "Comunidade" });
    const settingsLink = screen.getByRole("link", { name: "Configurações" });

    expect(campaignsLink).toHaveAttribute("title", "Campanhas");
    expect(campaignsLink).toHaveAttribute("aria-label", "Campanhas");
    expect(libraryLink).toHaveAttribute("title", "Biblioteca");
    expect(libraryLink).toHaveAttribute("aria-label", "Biblioteca");
    expect(communityLink).toHaveAttribute("title", "Comunidade");
    expect(communityLink).toHaveAttribute("aria-label", "Comunidade");
    expect(settingsLink).toHaveAttribute("title", "Configurações");
    expect(settingsLink).toHaveAttribute("aria-label", "Configurações");

    // SVG icons inside links
    expect(campaignsLink.querySelector("svg")).toBeInTheDocument();
    expect(libraryLink.querySelector("svg")).toBeInTheDocument();
    expect(communityLink.querySelector("svg")).toBeInTheDocument();
    expect(settingsLink.querySelector("svg")).toBeInTheDocument();
  });
});
