/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MasterJukebox } from "../MasterJukebox";
import { useJukebox } from "@/hooks/useJukebox";
import type { AudioTrack } from "@/lib/audio/jukebox-protocol";

const mockAddTrack = vi.fn();
const mockRemoveTrack = vi.fn();
const mockTogglePlay = vi.fn();
const mockSeekTrack = vi.fn();
const mockToggleLoop = vi.fn();
const mockStopAll = vi.fn();
const mockCreatePlaylist = vi.fn();
const mockUngroupPlaylist = vi.fn();
const mockSetTrackScene = vi.fn();

vi.mock("@/hooks/useJukebox", () => ({
  useJukebox: vi.fn(),
}));

vi.mock("@/components/audio/YouTubeAudioPlayer", () => ({
  YouTubeAudioPlayer: () => null,
}));

describe("MasterJukebox — Filtro e gestão por cena", () => {
  const sampleTracks: AudioTrack[] = [
    {
      id: "track-a",
      title: "Faixa Combate",
      addedBy: "u1",
      addedAt: "2026-11-08T00:00:00Z",
      scene: "combat",
    },
    {
      id: "track-b",
      title: "Faixa Geral",
      addedBy: "u1",
      addedAt: "2026-11-08T00:00:00Z",
      scene: null,
    },
    {
      id: "track-c",
      title: "Faixa Furtividade",
      addedBy: "u1",
      addedAt: "2026-11-08T00:00:00Z",
      scene: "stealth",
    },
  ];

  function createMockJukebox(overrides: Partial<ReturnType<typeof useJukebox>> = {}) {
    return {
      tracks: sampleTracks,
      playingTrackIds: new Set<string>(),
      playingTrackId: null,
      loopTrackIds: new Set<string>(),
      playingAt: null,
      trackPlayingAts: {},
      isLoading: false,
      addTrack: mockAddTrack.mockReturnValue({ ok: true }),
      removeTrack: mockRemoveTrack,
      togglePlay: mockTogglePlay,
      seekTrack: mockSeekTrack,
      stopAll: mockStopAll,
      toggleLoop: mockToggleLoop,
      createPlaylist: mockCreatePlaylist,
      ungroupPlaylist: mockUngroupPlaylist,
      setTrackScene: mockSetTrackScene,
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useJukebox).mockReturnValue(createMockJukebox() as any);
  });

  it("1. activeScene='combat' → exibe faixas de combate e gerais, oculta outras cenas", () => {
    render(<MasterJukebox campaignId="c1" userId="u1" userName="Mestre" activeScene="combat" />);

    expect(screen.getByText("Faixa Combate")).toBeInTheDocument();
    expect(screen.getByText("Faixa Geral")).toBeInTheDocument();
    expect(screen.queryByText("Faixa Furtividade")).not.toBeInTheDocument();
  });

  it("2. Chip 'Todas' clicado → exibe todas as faixas (override manual)", () => {
    render(<MasterJukebox campaignId="c1" userId="u1" userName="Mestre" activeScene="combat" />);

    expect(screen.queryByText("Faixa Furtividade")).not.toBeInTheDocument();

    const allChip = screen.getByTestId("jukebox-scene-chip-all");
    fireEvent.click(allChip);

    expect(screen.getByText("Faixa Combate")).toBeInTheDocument();
    expect(screen.getByText("Faixa Geral")).toBeInTheDocument();
    expect(screen.getByText("Faixa Furtividade")).toBeInTheDocument();
  });

  it("3. Troca do prop activeScene → reseta o override e volta ao filtro automático", () => {
    const { rerender } = render(
      <MasterJukebox campaignId="c1" userId="u1" userName="Mestre" activeScene="combat" />,
    );

    // Clica em 'Todas' para fazer override
    fireEvent.click(screen.getByTestId("jukebox-scene-chip-all"));
    expect(screen.getByText("Faixa Furtividade")).toBeInTheDocument();

    // Rerender com nova activeScene="stealth"
    rerender(<MasterJukebox campaignId="c1" userId="u1" userName="Mestre" activeScene="stealth" />);

    expect(screen.getByText("Faixa Furtividade")).toBeInTheDocument();
    expect(screen.getByText("Faixa Geral")).toBeInTheDocument();
    expect(screen.queryByText("Faixa Combate")).not.toBeInTheDocument();
  });

  it("4. activeScene null (Livre) → todas as faixas visíveis", () => {
    render(<MasterJukebox campaignId="c1" userId="u1" userName="Mestre" activeScene={null} />);

    expect(screen.getByText("Faixa Combate")).toBeInTheDocument();
    expect(screen.getByText("Faixa Geral")).toBeInTheDocument();
    expect(screen.getByText("Faixa Furtividade")).toBeInTheDocument();
  });

  it("5. select do add: escolher 'Combate' e adicionar → chama addTrack com 4º arg 'combat'", () => {
    render(<MasterJukebox campaignId="c1" userId="u1" userName="Mestre" />);

    const input = screen.getByPlaceholderText("Cole a URL do YouTube...");
    const sceneSelect = screen.getByTestId("jukebox-add-scene-select");
    const addBtn = screen.getByRole("button", { name: "Adicionar" });

    fireEvent.change(input, { target: { value: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" } });
    fireEvent.change(sceneSelect, { target: { value: "combat" } });
    fireEvent.click(addBtn);

    expect(mockAddTrack).toHaveBeenCalledWith(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "u1",
      "Mestre",
      "combat",
    );
  });

  it("6. select por faixa: alterar cena para Geral chama setTrackScene(id, null)", () => {
    render(<MasterJukebox campaignId="c1" userId="u1" userName="Mestre" activeScene={null} />);

    const trackSelect = screen.getByTestId("jukebox-track-scene-track-a");
    expect(trackSelect).toHaveValue("combat");

    fireEvent.change(trackSelect, { target: { value: "" } });

    expect(mockSetTrackScene).toHaveBeenCalledWith("track-a", null);
  });

  it("7. faixa em reprodução de cena oculta continua visível (pino de reprodução)", () => {
    vi.mocked(useJukebox).mockReturnValue(
      createMockJukebox({
        playingTrackIds: new Set(["track-c"]),
      }) as any,
    );

    render(<MasterJukebox campaignId="c1" userId="u1" userName="Mestre" activeScene="combat" />);

    // track-c é de stealth, mas está tocando → deve continuar visível!
    expect(screen.getByText("Faixa Combate")).toBeInTheDocument();
    expect(screen.getByText("Faixa Geral")).toBeInTheDocument();
    expect(screen.getByText("Faixa Furtividade")).toBeInTheDocument();
  });
});
