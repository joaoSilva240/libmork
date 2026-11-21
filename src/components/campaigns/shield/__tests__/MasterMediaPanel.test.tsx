import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MasterMediaPanel } from "../MasterMediaPanel";

vi.mock("@/components/campaigns/MasterJukebox", () => ({
  MasterJukebox: () => <div data-testid="master-jukebox-mock" />,
}));
vi.mock("@/components/campaigns/MasterAssetsPanel", () => ({
  MasterAssetsPanel: () => <div data-testid="master-assets-mock" />,
}));
vi.mock("../MasterWorldsPanel", () => ({
  MasterWorldsPanel: () => <div data-testid="master-worlds-mock" />,
}));
vi.mock("../MasterFalloutPanel", () => ({
  MasterFalloutPanel: () => <div data-testid="master-fallout-mock" />,
}));

const baseProps = {
  campaignId: "camp-1",
  masterId: "user-1",
  activeAssetId: null,
  isMissing: false,
  isFallout: false,
  showMap: true,
  showAssets: true,
  showJukebox: true,
  worlds: [],
  worldError: null,
  selectedWorldId: "",
  onSelectWorld: vi.fn(),
  onOpenWorld: vi.fn(),
  establishments: [],
  isEstablishmentsExpanded: false,
  onToggleEstablishmentsExpanded: vi.fn(),
  onToggleEstablishment: vi.fn(),
};

describe("MasterMediaPanel (issue #89)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders tabs for Mundos, Assets and Jukebox", () => {
    render(<MasterMediaPanel {...baseProps} />);

    expect(screen.getByTestId("shield-tab-worlds")).toBeInTheDocument();
    expect(screen.getByTestId("shield-tab-assets")).toBeInTheDocument();
    expect(screen.getByTestId("shield-tab-jukebox")).toBeInTheDocument();
    expect(screen.getByTestId("master-worlds-mock")).toBeInTheDocument();
  });

  it("keeps the Jukebox mounted (not unmounted) when switching to Mundos — áudio persiste", () => {
    render(<MasterMediaPanel {...baseProps} />);

    // Jukebox começa desmarcada; alterna para Mundos e verifica que o
    // componente permanece no DOM (só oculto), sem remontagem.
    fireEvent.click(screen.getByTestId("shield-tab-worlds"));

    const jukeboxPanel = screen.getByTestId("shield-tabpanel-jukebox");
    expect(jukeboxPanel).toBeInTheDocument();
    expect(jukeboxPanel).toHaveAttribute("hidden", "");
    expect(screen.getByTestId("master-jukebox-mock")).toBeInTheDocument();
  });

  it("omits tabs of disabled modules and does not mount their content", () => {
    render(<MasterMediaPanel {...baseProps} showJukebox={false} showAssets={false} />);

    expect(screen.queryByTestId("shield-tab-jukebox")).not.toBeInTheDocument();
    expect(screen.queryByTestId("master-jukebox-mock")).not.toBeInTheDocument();
    expect(screen.queryByTestId("shield-tab-assets")).not.toBeInTheDocument();
    // Mundos único visível: renderiza sem cabeçalho de abas.
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.getByTestId("master-worlds-mock")).toBeInTheDocument();
  });

  it("persists the preferred tab per panel key", async () => {
    const { unmount } = render(<MasterMediaPanel {...baseProps} />);

    fireEvent.click(screen.getByTestId("shield-tab-assets"));
    expect(localStorage.getItem("libmork:shield-tab:media")).toBe("assets");

    unmount();
    render(<MasterMediaPanel {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByTestId("shield-tab-assets")).toHaveAttribute("aria-selected", "true");
    });
  });

  it("não mostra a aba de recursos Fallout fora do sistema fallout_2d20", () => {
    render(<MasterMediaPanel {...baseProps} />);

    expect(screen.queryByTestId("shield-tab-fallout")).not.toBeInTheDocument();
    expect(screen.queryByTestId("master-fallout-mock")).not.toBeInTheDocument();
  });

  it("mostra a aba de recursos Fallout junto de Mundos e Jukebox no sistema 2d20", () => {
    render(<MasterMediaPanel {...baseProps} isFallout={true} />);

    expect(screen.getByTestId("shield-tab-fallout")).toBeInTheDocument();
    expect(screen.getByTestId("shield-tab-worlds")).toBeInTheDocument();
    expect(screen.getByTestId("shield-tab-jukebox")).toBeInTheDocument();
    expect(screen.getByTestId("master-fallout-mock")).toBeInTheDocument();
  });

  it("mantém o card de recursos montado ao trocar de aba", () => {
    render(<MasterMediaPanel {...baseProps} isFallout={true} />);

    fireEvent.click(screen.getByTestId("shield-tab-jukebox"));

    const falloutPanel = screen.getByTestId("shield-tabpanel-fallout");
    expect(falloutPanel).toHaveAttribute("hidden", "");
    expect(screen.getByTestId("master-fallout-mock")).toBeInTheDocument();
  });

  it("renderiza só o card de recursos quando a mídia está desligada numa campanha 2d20", () => {
    render(
      <MasterMediaPanel
        {...baseProps}
        isFallout={true}
        showMap={false}
        showAssets={false}
        showJukebox={false}
      />,
    );

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.getByTestId("master-fallout-mock")).toBeInTheDocument();
  });
});
