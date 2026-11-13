import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
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
    expect(settingsLink).toHaveClass("bg-accent/20", "text-accent-hover");
  });

  it("renders 'Comunidade' link with correct href", () => {
    mockUsePathname.mockReturnValue("/master/community");

    render(<MasterSidebar />);

    const communityLink = screen.getByRole("link", { name: /comunidade/i });
    expect(communityLink).toHaveAttribute("href", "/master/community");
    expect(communityLink).toHaveClass("bg-accent/20", "text-accent-hover");
  });

  it("renders accessible collapse/expand button with aria-expanded, aria-controls and lucide icon", () => {
    mockUsePathname.mockReturnValue("/master");
    render(<MasterSidebar />);

    const toggleButton = screen.getByRole("button", { name: "Recolher menu lateral" });
    expect(toggleButton).toHaveAttribute("aria-expanded", "true");
    expect(toggleButton).toHaveAttribute("aria-controls", "master-sidebar-nav");
    expect(toggleButton).toHaveClass("focus-visible:ring-2", "focus-visible:ring-accent");
    expect(toggleButton.querySelector("svg")).toBeInTheDocument();
  });

  it("renders accessible navigation links and lucide-react icons in expanded and collapsed states", () => {
    mockUsePathname.mockReturnValue("/master");

    render(<MasterSidebar />);

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

  afterEach(() => {
    delete window.desktopClient;
  });

  it("exibe o botão 'Trocar Servidor' no rodapé quando executado no Electron Desktop", () => {
    const disconnectSpy = vi.fn().mockResolvedValue(undefined);
    window.desktopClient = {
      isElectron: true,
      platform: "win32",
      version: "0.1.0",
      sendNotification: vi.fn(),
      getServerList: vi.fn().mockResolvedValue([]),
      saveServer: vi.fn(),
      removeServer: vi.fn(),
      getActiveServer: vi.fn().mockResolvedValue("http://localhost:3000"),
      setActiveServer: vi.fn(),
      disconnectServer: disconnectSpy,
      checkServerHealth: vi.fn(),
      openExternal: vi.fn(),
      minimize: vi.fn(),
      maximize: vi.fn(),
      close: vi.fn(),
      isMaximized: vi.fn(),
      onJukeboxTogglePlay: vi.fn(() => () => {}),
      onJukeboxMute: vi.fn(() => () => {}),
      onUpdateAvailable: vi.fn(() => () => {}),
      onUpdateDownloaded: vi.fn(() => () => {}),
    };

    mockUsePathname.mockReturnValue("/master");
    render(<MasterSidebar />);

    const switchBtn = screen.getByRole("button", { name: "Trocar Servidor (Gateway)" });
    expect(switchBtn).toBeInTheDocument();
    fireEvent.click(switchBtn);
    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });
});
