import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MasterJukebox } from "../MasterJukebox";
import { useJukebox } from "@/hooks/useJukebox";

// Mock do hook useJukebox
const mockAddTrack = vi.fn();
const mockRemoveTrack = vi.fn();
const mockTogglePlay = vi.fn();
const mockToggleLoop = vi.fn();

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
      playingTrackId: null,
      loopTrackIds: new Set(),
      playingAt: null,
      addTrack: mockAddTrack,
      removeTrack: mockRemoveTrack,
      togglePlay: mockTogglePlay,
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
      screen.getByText("Nenhuma faixa de áudio adicionada. Cole uma URL do YouTube para começar.")
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
      "Mestre"
    );
    expect(input.value).toBe("");
    expect(screen.queryByText("URL inválida do YouTube")).not.toBeInTheDocument();
  });

  it("lista de tracks renderiza cada track com título", () => {
    vi.mocked(useJukebox).mockReturnValue({
      tracks: [
        { id: "dQw4w9WgXcQ", title: "Rick Astley - Never Gonna Give You Up", addedBy: "u1", addedAt: "2026-11-01T00:00:00Z" },
        { id: "9bZkp7q19f0", title: "PSY - GANGNAM STYLE", addedBy: "u1", addedAt: "2026-11-01T00:01:00Z" },
      ],
      playingTrackId: null,
      loopTrackIds: new Set(),
      playingAt: null,
      addTrack: mockAddTrack,
      removeTrack: mockRemoveTrack,
      togglePlay: mockTogglePlay,
      toggleLoop: mockToggleLoop,
    });

    render(<MasterJukebox campaignId="c1" userId="u1" userName="Mestre" />);

    expect(screen.getByText("Rick Astley - Never Gonna Give You Up")).toBeInTheDocument();
    expect(screen.getByText("PSY - GANGNAM STYLE")).toBeInTheDocument();
  });

  it("botão play → chama togglePlay(trackId)", () => {
    vi.mocked(useJukebox).mockReturnValue({
      tracks: [{ id: "dQw4w9WgXcQ", title: "Never Gonna Give You Up", addedBy: "u1", addedAt: "2026-11-01T00:00:00Z" }],
      playingTrackId: null,
      loopTrackIds: new Set(),
      playingAt: null,
      addTrack: mockAddTrack,
      removeTrack: mockRemoveTrack,
      togglePlay: mockTogglePlay,
      toggleLoop: mockToggleLoop,
    });

    render(<MasterJukebox campaignId="c1" userId="u1" userName="Mestre" />);

    const playButton = screen.getByRole("button", { name: "Reproduzir" });
    fireEvent.click(playButton);

    expect(mockTogglePlay).toHaveBeenCalledWith("dQw4w9WgXcQ");
  });

  it("botão loop → chama toggleLoop(trackId)", () => {
    vi.mocked(useJukebox).mockReturnValue({
      tracks: [{ id: "dQw4w9WgXcQ", title: "Never Gonna Give You Up", addedBy: "u1", addedAt: "2026-11-01T00:00:00Z" }],
      playingTrackId: null,
      loopTrackIds: new Set(),
      playingAt: null,
      addTrack: mockAddTrack,
      removeTrack: mockRemoveTrack,
      togglePlay: mockTogglePlay,
      toggleLoop: mockToggleLoop,
    });

    render(<MasterJukebox campaignId="c1" userId="u1" userName="Mestre" />);

    const loopButton = screen.getByRole("button", { name: "Loop" });
    fireEvent.click(loopButton);

    expect(mockToggleLoop).toHaveBeenCalledWith("dQw4w9WgXcQ");
  });

  it("botão remover → chama removeTrack(trackId)", () => {
    vi.mocked(useJukebox).mockReturnValue({
      tracks: [{ id: "dQw4w9WgXcQ", title: "Never Gonna Give You Up", addedBy: "u1", addedAt: "2026-11-01T00:00:00Z" }],
      playingTrackId: null,
      loopTrackIds: new Set(),
      playingAt: null,
      addTrack: mockAddTrack,
      removeTrack: mockRemoveTrack,
      togglePlay: mockTogglePlay,
      toggleLoop: mockToggleLoop,
    });

    render(<MasterJukebox campaignId="c1" userId="u1" userName="Mestre" />);

    const removeButton = screen.getByRole("button", { name: "Remover" });
    fireEvent.click(removeButton);

    expect(mockRemoveTrack).toHaveBeenCalledWith("dQw4w9WgXcQ");
  });

  it("volume slider onChange atualiza estado local (não chama hook)", () => {
    vi.mocked(useJukebox).mockReturnValue({
      tracks: [{ id: "dQw4w9WgXcQ", title: "Never Gonna Give You Up", addedBy: "u1", addedAt: "2026-11-01T00:00:00Z" }],
      playingTrackId: null,
      loopTrackIds: new Set(),
      playingAt: null,
      addTrack: mockAddTrack,
      removeTrack: mockRemoveTrack,
      togglePlay: mockTogglePlay,
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

  it("YouTubeAudioPlayer renderizado com props playing, volume, loop corretas", () => {
    vi.mocked(useJukebox).mockReturnValue({
      tracks: [
        { id: "dQw4w9WgXcQ", title: "Never Gonna Give You Up", addedBy: "u1", addedAt: "2026-11-01T00:00:00Z" },
        { id: "9bZkp7q19f0", title: "GANGNAM STYLE", addedBy: "u1", addedAt: "2026-11-01T00:01:00Z" },
      ],
      playingTrackId: "dQw4w9WgXcQ",
      loopTrackIds: new Set(["9bZkp7q19f0"]),
      playingAt: Date.now(),
      addTrack: mockAddTrack,
      removeTrack: mockRemoveTrack,
      togglePlay: mockTogglePlay,
      toggleLoop: mockToggleLoop,
    });

    render(<MasterJukebox campaignId="c1" userId="u1" userName="Mestre" />);

    // Player 1: playing=true, loop=false, volume=50 (padrão)
    const player1 = screen.getByTestId("youtube-player-dQw4w9WgXcQ");
    expect(player1).toHaveAttribute("data-playing", "true");
    expect(player1).toHaveAttribute("data-volume", "50");
    expect(player1).toHaveAttribute("data-loop", "false");

    // Player 2: playing=false, loop=true, volume=50 (padrão)
    const player2 = screen.getByTestId("youtube-player-9bZkp7q19f0");
    expect(player2).toHaveAttribute("data-playing", "false");
    expect(player2).toHaveAttribute("data-volume", "50");
    expect(player2).toHaveAttribute("data-loop", "true");
  });
});
