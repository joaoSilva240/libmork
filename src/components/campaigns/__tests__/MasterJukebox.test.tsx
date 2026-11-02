import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MasterJukebox } from "../MasterJukebox";
import { useJukebox } from "@/hooks/useJukebox";

// Mock do hook useJukebox
const mockAddTrack = vi.fn();
const mockRemoveTrack = vi.fn();
const mockTogglePlay = vi.fn();
const mockToggleLoop = vi.fn();
const mockStopAll = vi.fn();

vi.mock("@/hooks/useJukebox", () => ({
  useJukebox: vi.fn(),
}));

// Mock do YouTubeAudioPlayer
vi.mock("@/components/audio/YouTubeAudioPlayer", () => ({
  YouTubeAudioPlayer: ({ videoId, playing, volume, loop }: any) => (
    <div
      data-testid={`youtube-player-${videoId}`}
      data-playing={playing}
      data-volume={volume}
      data-loop={loop}
    />
  ),
}));

describe("MasterJukebox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset para o mock padrão
    vi.mocked(useJukebox).mockReturnValue({
      tracks: [],
      playingTrackIds: new Set(),
      playingTrackId: null,
      loopTrackIds: new Set(),
      playingAt: null,
      isLoading: false,
      addTrack: mockAddTrack,
      removeTrack: mockRemoveTrack,
      togglePlay: mockTogglePlay,
      stopAll: mockStopAll,
      toggleLoop: mockToggleLoop,
    });
  });

  it("renderiza título '🎵 Jukebox de Áudio'", () => {
    render(<MasterJukebox campaignId="c1" userId="u1" userName="Mestre" />);
    expect(screen.getByText("🎵 Jukebox de Áudio")).toBeInTheDocument();
  });

  it("mostra placeholder quando tracks = []", () => {
    render(<MasterJukebox campaignId="c1" userId="u1" userName="Mestre" />);
    expect(
      screen.getByText("Nenhuma faixa de áudio adicionada. Cole uma URL do YouTube para começar."),
    ).toBeInTheDocument();
  });

  it("renderiza input + botão 'Adicionar'", () => {
    render(<MasterJukebox campaignId="c1" userId="u1" userName="Mestre" />);
    const input = screen.getByPlaceholderText("Cole a URL do YouTube...");
    expect(input).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Adicionar" });
    expect(button).toBeInTheDocument();
  });

  it("addTrack com erro → mostra mensagem de erro inline", () => {
    mockAddTrack.mockReturnValue({ ok: false, error: "URL inválida do YouTube" });

    render(<MasterJukebox campaignId="c1" userId="u1" userName="Mestre" />);

    const input = screen.getByPlaceholderText("Cole a URL do YouTube...");
    fireEvent.change(input, { target: { value: "https://invalid.url" } });

    const button = screen.getByRole("button", { name: "Adicionar" });
    fireEvent.click(button);

    expect(mockAddTrack).toHaveBeenCalledWith("https://invalid.url", "u1", "Mestre");
    expect(screen.getByText("URL inválida do YouTube")).toBeInTheDocument();
  });

  it("addTrack com sucesso → limpa input e erro", () => {
    mockAddTrack.mockReturnValue({ ok: true });

    render(<MasterJukebox campaignId="c1" userId="u1" userName="Mestre" />);

    const input = screen.getByPlaceholderText("Cole a URL do YouTube...") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "https://youtube.com/watch?v=dQw4w9WgXcQ" } });

    const button = screen.getByRole("button", { name: "Adicionar" });
    fireEvent.click(button);

    expect(mockAddTrack).toHaveBeenCalledWith(
      "https://youtube.com/watch?v=dQw4w9WgXcQ",
      "u1",
      "Mestre",
    );
    expect(input.value).toBe("");
    expect(screen.queryByText("URL inválida do YouTube")).not.toBeInTheDocument();
  });

  it("lista de tracks renderiza cada track com título", () => {
    vi.mocked(useJukebox).mockReturnValue({
      tracks: [
        {
          id: "dQw4w9WgXcQ",
          title: "Never Gonna Give You Up",
          addedBy: "u1",
          addedAt: "2026-11-01T00:00:00Z",
        },
        {
          id: "9bZkp7q19f0",
          title: "GANGNAM STYLE",
          addedBy: "u1",
          addedAt: "2026-11-01T00:01:00Z",
        },
      ],
      playingTrackIds: new Set(),
      playingTrackId: null,
      loopTrackIds: new Set(),
      playingAt: null,
      isLoading: false,
      addTrack: mockAddTrack,
      removeTrack: mockRemoveTrack,
      togglePlay: mockTogglePlay,
      stopAll: mockStopAll,
      toggleLoop: mockToggleLoop,
    });

    render(<MasterJukebox campaignId="c1" userId="u1" userName="Mestre" />);

    expect(screen.getByText("Never Gonna Give You Up")).toBeInTheDocument();
    expect(screen.getByText("GANGNAM STYLE")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Reproduzir" })).toHaveLength(2);
  });

  it("togglePlay alterna entre Play e Pause", () => {
    vi.mocked(useJukebox).mockReturnValue({
      tracks: [
        {
          id: "dQw4w9WgXcQ",
          title: "Never Gonna Give You Up",
          addedBy: "u1",
          addedAt: "2026-11-01T00:00:00Z",
        },
      ],
      playingTrackIds: new Set(["dQw4w9WgXcQ"]),
      playingTrackId: "dQw4w9WgXcQ",
      loopTrackIds: new Set(),
      playingAt: Date.now(),
      isLoading: false,
      addTrack: mockAddTrack,
      removeTrack: mockRemoveTrack,
      togglePlay: mockTogglePlay,
      stopAll: mockStopAll,
      toggleLoop: mockToggleLoop,
    });

    render(<MasterJukebox campaignId="c1" userId="u1" userName="Mestre" />);

    const pauseButton = screen.getByRole("button", { name: "Pausar" });
    expect(pauseButton).toBeInTheDocument();

    fireEvent.click(pauseButton);
    expect(mockTogglePlay).toHaveBeenCalledWith("dQw4w9WgXcQ");
  });

  it("suporta múltiplas faixas tocando simultaneamente", () => {
    vi.mocked(useJukebox).mockReturnValue({
      tracks: [
        { id: "track-1", title: "Chuva e Trovões", addedBy: "u1", addedAt: "2026-11-01T00:00:00Z" },
        {
          id: "track-2",
          title: "Música de Batalha",
          addedBy: "u1",
          addedAt: "2026-11-01T00:01:00Z",
        },
      ],
      playingTrackIds: new Set(["track-1", "track-2"]),
      playingTrackId: "track-1",
      loopTrackIds: new Set(),
      playingAt: Date.now(),
      isLoading: false,
      addTrack: mockAddTrack,
      removeTrack: mockRemoveTrack,
      togglePlay: mockTogglePlay,
      stopAll: mockStopAll,
      toggleLoop: mockToggleLoop,
    });

    render(<MasterJukebox campaignId="c1" userId="u1" userName="Mestre" />);

    // Ambos os botões devem estar em estado "Pausar"
    const pauseButtons = screen.getAllByRole("button", { name: "Pausar" });
    expect(pauseButtons).toHaveLength(2);

    // Ambos os players devem estar com playing=true
    const player1 = screen.getByTestId("youtube-player-track-1");
    const player2 = screen.getByTestId("youtube-player-track-2");
    expect(player1).toHaveAttribute("data-playing", "true");
    expect(player2).toHaveAttribute("data-playing", "true");

    // Botão Parar Todos visível
    const stopAllBtn = screen.getByRole("button", { name: "Parar Todos" });
    expect(stopAllBtn).toBeInTheDocument();
    fireEvent.click(stopAllBtn);
    expect(mockStopAll).toHaveBeenCalledTimes(1);
  });

  it("botão loop → chama toggleLoop(trackId)", () => {
    vi.mocked(useJukebox).mockReturnValue({
      tracks: [
        {
          id: "dQw4w9WgXcQ",
          title: "Never Gonna Give You Up",
          addedBy: "u1",
          addedAt: "2026-11-01T00:00:00Z",
        },
      ],
      playingTrackIds: new Set(),
      playingTrackId: null,
      loopTrackIds: new Set(["dQw4w9WgXcQ"]),
      playingAt: null,
      isLoading: false,
      addTrack: mockAddTrack,
      removeTrack: mockRemoveTrack,
      togglePlay: mockTogglePlay,
      stopAll: mockStopAll,
      toggleLoop: mockToggleLoop,
    });

    render(<MasterJukebox campaignId="c1" userId="u1" userName="Mestre" />);

    const loopButton = screen.getByRole("button", { name: "Loop" });
    fireEvent.click(loopButton);

    expect(mockToggleLoop).toHaveBeenCalledWith("dQw4w9WgXcQ");
  });

  it("botão remover → chama removeTrack(trackId)", () => {
    vi.mocked(useJukebox).mockReturnValue({
      tracks: [
        {
          id: "dQw4w9WgXcQ",
          title: "Never Gonna Give You Up",
          addedBy: "u1",
          addedAt: "2026-11-01T00:00:00Z",
        },
      ],
      playingTrackIds: new Set(),
      playingTrackId: null,
      loopTrackIds: new Set(),
      playingAt: null,
      isLoading: false,
      addTrack: mockAddTrack,
      removeTrack: mockRemoveTrack,
      togglePlay: mockTogglePlay,
      stopAll: mockStopAll,
      toggleLoop: mockToggleLoop,
    });

    render(<MasterJukebox campaignId="c1" userId="u1" userName="Mestre" />);

    const removeButton = screen.getByRole("button", { name: "Remover" });
    fireEvent.click(removeButton);

    expect(mockRemoveTrack).toHaveBeenCalledWith("dQw4w9WgXcQ");
  });

  it("volume slider onChange atualiza estado local (não chama hook)", () => {
    vi.mocked(useJukebox).mockReturnValue({
      tracks: [
        {
          id: "dQw4w9WgXcQ",
          title: "Never Gonna Give You Up",
          addedBy: "u1",
          addedAt: "2026-11-01T00:00:00Z",
        },
      ],
      playingTrackIds: new Set(),
      playingTrackId: null,
      loopTrackIds: new Set(),
      playingAt: null,
      isLoading: false,
      addTrack: mockAddTrack,
      removeTrack: mockRemoveTrack,
      togglePlay: mockTogglePlay,
      stopAll: mockStopAll,
      toggleLoop: mockToggleLoop,
    });

    render(<MasterJukebox campaignId="c1" userId="u1" userName="Mestre" />);

    const volumeSlider = screen.getByRole("slider", { name: "Volume" }) as HTMLInputElement;
    expect(volumeSlider.value).toBe("50"); // valor padrão

    fireEvent.change(volumeSlider, { target: { value: "75" } });
    expect(volumeSlider.value).toBe("75");

    // Verifica que nenhum método do hook foi chamado
    expect(mockTogglePlay).not.toHaveBeenCalled();
    expect(mockToggleLoop).not.toHaveBeenCalled();
    expect(mockRemoveTrack).not.toHaveBeenCalled();
  });
});
