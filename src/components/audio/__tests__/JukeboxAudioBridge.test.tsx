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
      playingTrackId: null,
      loopTrackIds: new Set(),
      playingAt: null,
      addTrack: vi.fn(),
      removeTrack: vi.fn(),
      togglePlay: vi.fn(),
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
      playingTrackId: null,
      loopTrackIds: new Set(),
      playingAt: null,
      addTrack: vi.fn(),
      removeTrack: vi.fn(),
      togglePlay: vi.fn(),
      toggleLoop: vi.fn(),
    };
    vi.mocked(useJukebox).mockReturnValue(mockReturn);

    render(<JukeboxAudioBridge campaignId="campaign-123" />);

    expect(screen.getByTestId("youtube-player-video1")).toBeInTheDocument();
    expect(screen.getByTestId("youtube-player-video2")).toBeInTheDocument();
    expect(screen.getByTestId("youtube-player-video3")).toBeInTheDocument();
  });

  it("props corretas: playing true quando playingTrackId match", () => {
    const tracks: AudioTrack[] = [
      { id: "video1", title: "Track 1", addedBy: "Master", addedAt: "2026-11-01T00:00:00Z" },
      { id: "video2", title: "Track 2", addedBy: "Master", addedAt: "2026-11-01T00:00:00Z" },
    ];

    const mockReturn: UseJukeboxReturn = {
      tracks,
      playingTrackId: "video2",
      loopTrackIds: new Set(),
      playingAt: Date.now(),
      addTrack: vi.fn(),
      removeTrack: vi.fn(),
      togglePlay: vi.fn(),
      toggleLoop: vi.fn(),
    };
    vi.mocked(useJukebox).mockReturnValue(mockReturn);

    render(<JukeboxAudioBridge campaignId="campaign-123" />);

    const player1 = screen.getByTestId("youtube-player-video1");
    const player2 = screen.getByTestId("youtube-player-video2");

    expect(player1).toHaveAttribute("data-playing", "false");
    expect(player2).toHaveAttribute("data-playing", "true");
  });

  it("props loop true quando track em loopTrackIds", () => {
    const tracks: AudioTrack[] = [
      { id: "video1", title: "Track 1", addedBy: "Master", addedAt: "2026-11-01T00:00:00Z" },
      { id: "video2", title: "Track 2", addedBy: "Master", addedAt: "2026-11-01T00:00:00Z" },
      { id: "video3", title: "Track 3", addedBy: "Master", addedAt: "2026-11-01T00:00:00Z" },
    ];

    const mockReturn: UseJukeboxReturn = {
      tracks,
      playingTrackId: null,
      loopTrackIds: new Set(["video1", "video3"]),
      playingAt: null,
      addTrack: vi.fn(),
      removeTrack: vi.fn(),
      togglePlay: vi.fn(),
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
      playingTrackId: null,
      loopTrackIds: new Set(),
      playingAt: null,
      addTrack: vi.fn(),
      removeTrack: vi.fn(),
      togglePlay: vi.fn(),
      toggleLoop: vi.fn(),
    };
    vi.mocked(useJukebox).mockReturnValue(mockReturn);

    render(<JukeboxAudioBridge campaignId="campaign-123" />);

    const player1 = screen.getByTestId("youtube-player-video1");
    expect(player1).toHaveAttribute("data-volume", "50");
  });
});
