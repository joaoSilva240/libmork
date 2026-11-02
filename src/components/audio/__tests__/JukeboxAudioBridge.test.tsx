import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { JukeboxAudioBridge } from "../JukeboxAudioBridge";
import type { UseJukeboxReturn } from "@/hooks/useJukebox";
import type { AudioTrack } from "@/lib/audio/jukebox-protocol";

// Mock useJukebox
vi.mock("@/hooks/useJukebox", () => ({
  useJukebox: vi.fn(),
}));

// Mock YouTubeAudioPlayer
vi.mock("../YouTubeAudioPlayer", () => ({
  YouTubeAudioPlayer: vi.fn(({ videoId, playing, volume, loop }) => (
    <div
      data-testid={`youtube-player-${videoId}`}
      data-playing={playing}
      data-volume={volume}
      data-loop={loop}
    />
  )),
}));

const { useJukebox } = await import("@/hooks/useJukebox");

describe("JukeboxAudioBridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza sem UI visível (div.hidden)", () => {
    const mockReturn: UseJukeboxReturn = {
      tracks: [],
      playingTrackIds: new Set(),
      playingTrackId: null,
      loopTrackIds: new Set(),
      playingAt: null,
      isLoading: false,
      addTrack: vi.fn(),
      removeTrack: vi.fn(),
      togglePlay: vi.fn(),
      stopAll: vi.fn(),
      toggleLoop: vi.fn(),
    };
    vi.mocked(useJukebox).mockReturnValue(mockReturn);

    render(<JukeboxAudioBridge campaignId="campaign-123" />);

    const bridge = screen.getByTestId("jukebox-audio-bridge");
    expect(bridge).toBeInTheDocument();
    expect(bridge).toHaveClass("hidden");
    expect(bridge).toHaveAttribute("aria-hidden");
  });

  it("renderiza YouTubeAudioPlayer para cada track", () => {
    const tracks: AudioTrack[] = [
      { id: "video1", title: "Track 1", addedBy: "Master", addedAt: "2026-11-01T00:00:00Z" },
      { id: "video2", title: "Track 2", addedBy: "Master", addedAt: "2026-11-01T00:00:00Z" },
      { id: "video3", title: "Track 3", addedBy: "Master", addedAt: "2026-11-01T00:00:00Z" },
    ];

    const mockReturn: UseJukeboxReturn = {
      tracks,
      playingTrackIds: new Set(),
      playingTrackId: null,
      loopTrackIds: new Set(),
      playingAt: null,
      isLoading: false,
      addTrack: vi.fn(),
      removeTrack: vi.fn(),
      togglePlay: vi.fn(),
      stopAll: vi.fn(),
      toggleLoop: vi.fn(),
    };
    vi.mocked(useJukebox).mockReturnValue(mockReturn);

    render(<JukeboxAudioBridge campaignId="campaign-123" />);

    const player1 = screen.getByTestId("youtube-player-video1");
    const player2 = screen.getByTestId("youtube-player-video2");
    const player3 = screen.getByTestId("youtube-player-video3");

    expect(player1).toBeInTheDocument();
    expect(player2).toBeInTheDocument();
    expect(player3).toBeInTheDocument();
  });

  it("props playing corretas quando track está tocando", () => {
    const tracks: AudioTrack[] = [
      { id: "video1", title: "Track 1", addedBy: "Master", addedAt: "2026-11-01T00:00:00Z" },
      { id: "video2", title: "Track 2", addedBy: "Master", addedAt: "2026-11-01T00:00:00Z" },
    ];

    const mockReturn: UseJukeboxReturn = {
      tracks,
      playingTrackIds: new Set(["video2"]),
      playingTrackId: "video2",
      loopTrackIds: new Set(),
      playingAt: 1234567890,
      isLoading: false,
      addTrack: vi.fn(),
      removeTrack: vi.fn(),
      togglePlay: vi.fn(),
      stopAll: vi.fn(),
      toggleLoop: vi.fn(),
    };
    vi.mocked(useJukebox).mockReturnValue(mockReturn);

    render(<JukeboxAudioBridge campaignId="campaign-123" />);

    const player1 = screen.getByTestId("youtube-player-video1");
    const player2 = screen.getByTestId("youtube-player-video2");

    expect(player1).toHaveAttribute("data-playing", "false");
    expect(player2).toHaveAttribute("data-playing", "true");
  });

  it("renderiza múltiplos players tocando simultaneamente via playingTrackIds", () => {
    const tracks: AudioTrack[] = [
      { id: "video1", title: "Track 1", addedBy: "Master", addedAt: "2026-11-01T00:00:00Z" },
      { id: "video2", title: "Track 2", addedBy: "Master", addedAt: "2026-11-01T00:00:00Z" },
      { id: "video3", title: "Track 3", addedBy: "Master", addedAt: "2026-11-01T00:00:00Z" },
    ];

    const mockReturn: UseJukeboxReturn = {
      tracks,
      playingTrackIds: new Set(["video1", "video2"]),
      playingTrackId: "video1",
      loopTrackIds: new Set(),
      playingAt: Date.now(),
      isLoading: false,
      addTrack: vi.fn(),
      removeTrack: vi.fn(),
      togglePlay: vi.fn(),
      stopAll: vi.fn(),
      toggleLoop: vi.fn(),
    };
    vi.mocked(useJukebox).mockReturnValue(mockReturn);

    render(<JukeboxAudioBridge campaignId="campaign-123" />);

    const player1 = screen.getByTestId("youtube-player-video1");
    const player2 = screen.getByTestId("youtube-player-video2");
    const player3 = screen.getByTestId("youtube-player-video3");

    expect(player1).toHaveAttribute("data-playing", "true");
    expect(player2).toHaveAttribute("data-playing", "true");
    expect(player3).toHaveAttribute("data-playing", "false");
  });

  it("props loop true quando track em loopTrackIds", () => {
    const tracks: AudioTrack[] = [
      { id: "video1", title: "Track 1", addedBy: "Master", addedAt: "2026-11-01T00:00:00Z" },
      { id: "video2", title: "Track 2", addedBy: "Master", addedAt: "2026-11-01T00:00:00Z" },
      { id: "video3", title: "Track 3", addedBy: "Master", addedAt: "2026-11-01T00:00:00Z" },
    ];

    const mockReturn: UseJukeboxReturn = {
      tracks,
      playingTrackIds: new Set(),
      playingTrackId: null,
      loopTrackIds: new Set(["video1", "video3"]),
      playingAt: null,
      isLoading: false,
      addTrack: vi.fn(),
      removeTrack: vi.fn(),
      togglePlay: vi.fn(),
      stopAll: vi.fn(),
      toggleLoop: vi.fn(),
    };
    vi.mocked(useJukebox).mockReturnValue(mockReturn);

    render(<JukeboxAudioBridge campaignId="campaign-123" />);

    const player1 = screen.getByTestId("youtube-player-video1");
    const player2 = screen.getByTestId("youtube-player-video2");
    const player3 = screen.getByTestId("youtube-player-video3");

    expect(player1).toHaveAttribute("data-loop", "true");
    expect(player2).toHaveAttribute("data-loop", "false");
    expect(player3).toHaveAttribute("data-loop", "true");
  });

  it("volume padrão 50 quando não configurado", () => {
    const tracks: AudioTrack[] = [
      { id: "video1", title: "Track 1", addedBy: "Master", addedAt: "2026-11-01T00:00:00Z" },
    ];

    const mockReturn: UseJukeboxReturn = {
      tracks,
      playingTrackIds: new Set(),
      playingTrackId: null,
      loopTrackIds: new Set(),
      playingAt: null,
      isLoading: false,
      addTrack: vi.fn(),
      removeTrack: vi.fn(),
      togglePlay: vi.fn(),
      stopAll: vi.fn(),
      toggleLoop: vi.fn(),
    };
    vi.mocked(useJukebox).mockReturnValue(mockReturn);

    render(<JukeboxAudioBridge campaignId="campaign-123" />);

    const player1 = screen.getByTestId("youtube-player-video1");
    expect(player1).toHaveAttribute("data-volume", "50");
  });
});
