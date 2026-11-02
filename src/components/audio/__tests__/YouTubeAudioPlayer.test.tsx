// =============================================================================
// Libmork — Audio: Testes do YouTubeAudioPlayer (Issue #60)
// =============================================================================

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { YouTubeAudioPlayer } from "../YouTubeAudioPlayer";

// Mock do loader
vi.mock("@/lib/audio/youTubeApi", () => ({
  loadYouTubeIframeApi: vi.fn(),
}));

import { loadYouTubeIframeApi } from "@/lib/audio/youTubeApi";

describe("YouTubeAudioPlayer", () => {
  let mockPlayer: any;
  let mockYT: any;
  let playerConfig: any;

  beforeEach(() => {
    vi.useFakeTimers();

    mockPlayer = {
      playVideo: vi.fn(),
      pauseVideo: vi.fn(),
      setVolume: vi.fn(),
      seekTo: vi.fn(),
      destroy: vi.fn(),
      loadVideoById: vi.fn(),
      getPlayerState: vi.fn(() => -1), // UNSTARTED por padrão
      mute: vi.fn(),
      unMute: vi.fn(),
      getCurrentTime: vi.fn(() => 15),
      getDuration: vi.fn(() => 180),
    };

    mockYT = {
      Player: vi.fn((element: any, config: any) => {
        playerConfig = config;
        // Simula onReady assíncrono
        Promise.resolve().then(() => {
          if (config.events?.onReady) {
            config.events.onReady({ target: mockPlayer });
          }
        });
        return mockPlayer;
      }),
      PlayerState: {
        UNSTARTED: -1,
        ENDED: 0,
        PLAYING: 1,
        PAUSED: 2,
        BUFFERING: 3,
        CUED: 5,
      },
    };

    vi.mocked(loadYouTubeIframeApi).mockResolvedValue(mockYT);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renderiza div com testid correto", async () => {
    const { getByTestId } = render(<YouTubeAudioPlayer videoId="dQw4w9WgXcQ" />);

    expect(getByTestId("youtube-audio-player-dQw4w9WgXcQ")).toBeInTheDocument();
  });

  it("cria player com configuração correta", async () => {
    render(<YouTubeAudioPlayer videoId="dQw4w9WgXcQ" />);

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockYT.Player).toHaveBeenCalledTimes(1);
    expect(playerConfig.height).toBe("0");
    expect(playerConfig.width).toBe("0");
    expect(playerConfig.videoId).toBe("dQw4w9WgXcQ");
    expect(playerConfig.playerVars).toEqual({
      autoplay: 0,
      controls: 0,
      disablekb: 1,
      modestbranding: 1,
      playsinline: 1,
    });
  });

  it("chama setVolume e unMute quando volume > 0", async () => {
    render(<YouTubeAudioPlayer videoId="dQw4w9WgXcQ" volume={75} />);

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockPlayer.setVolume).toHaveBeenCalledWith(75);
    expect(mockPlayer.unMute).toHaveBeenCalled();
  });

  it("chama setVolume sem unMute quando volume = 0", async () => {
    render(<YouTubeAudioPlayer videoId="dQw4w9WgXcQ" volume={0} />);

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockPlayer.setVolume).toHaveBeenCalledWith(0);
    expect(mockPlayer.unMute).not.toHaveBeenCalled();
  });

  it("playing=true chama playVideo quando não está tocando", async () => {
    mockPlayer.getPlayerState.mockReturnValue(-1); // UNSTARTED

    const { rerender } = render(<YouTubeAudioPlayer videoId="dQw4w9WgXcQ" playing={false} />);

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    rerender(<YouTubeAudioPlayer videoId="dQw4w9WgXcQ" playing={true} />);

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockPlayer.playVideo).toHaveBeenCalled();
  });

  it("playing=false chama pauseVideo quando está tocando", async () => {
    mockPlayer.getPlayerState.mockReturnValue(1); // PLAYING

    const { rerender } = render(<YouTubeAudioPlayer videoId="dQw4w9WgXcQ" playing={true} />);

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    rerender(<YouTubeAudioPlayer videoId="dQw4w9WgXcQ" playing={false} />);

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockPlayer.pauseVideo).toHaveBeenCalled();
  });

  it("seekTime prop chama player.seekTo com o tempo correto", async () => {
    const { rerender } = render(<YouTubeAudioPlayer videoId="dQw4w9WgXcQ" seekTime={null} />);

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    rerender(<YouTubeAudioPlayer videoId="dQw4w9WgXcQ" seekTime={42} />);

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockPlayer.seekTo).toHaveBeenCalledWith(42, true);
  });

  it("onTimeUpdate é notificado com tempo atual e duração", async () => {
    const onTimeUpdate = vi.fn();
    mockPlayer.getCurrentTime.mockReturnValue(30);
    mockPlayer.getDuration.mockReturnValue(200);

    render(<YouTubeAudioPlayer videoId="dQw4w9WgXcQ" playing={true} onTimeUpdate={onTimeUpdate} />);

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(onTimeUpdate).toHaveBeenCalledWith(30, 200);
  });

  it("notifica onStateChange quando estado do player muda", async () => {
    const onStateChange = vi.fn();
    render(<YouTubeAudioPlayer videoId="dQw4w9WgXcQ" onStateChange={onStateChange} />);

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // UNSTARTED
    act(() => {
      playerConfig.events.onStateChange({ data: -1, target: mockPlayer });
    });
    expect(onStateChange).toHaveBeenCalledWith("unstarted");

    // PLAYING
    act(() => {
      playerConfig.events.onStateChange({ data: 1, target: mockPlayer });
    });
    expect(onStateChange).toHaveBeenCalledWith("playing");

    // PAUSED
    act(() => {
      playerConfig.events.onStateChange({ data: 2, target: mockPlayer });
    });
    expect(onStateChange).toHaveBeenCalledWith("paused");

    // ENDED
    act(() => {
      playerConfig.events.onStateChange({ data: 0, target: mockPlayer });
    });
    expect(onStateChange).toHaveBeenCalledWith("ended");
  });

  it("onError chama onStateChange com error", async () => {
    const onStateChange = vi.fn();
    render(<YouTubeAudioPlayer videoId="dQw4w9WgXcQ" onStateChange={onStateChange} />);

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    act(() => {
      playerConfig.events.onError({ data: 101, target: mockPlayer });
    });
    expect(onStateChange).toHaveBeenCalledWith("error");
  });

  it("loop=true reinicia vídeo ao terminar", async () => {
    render(<YouTubeAudioPlayer videoId="dQw4w9WgXcQ" loop={true} />);

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Simula ENDED
    act(() => {
      playerConfig.events.onStateChange({ data: 0, target: mockPlayer });
    });

    expect(mockPlayer.seekTo).toHaveBeenCalledWith(0, true);
    expect(mockPlayer.playVideo).toHaveBeenCalled();
  });

  it("loop=false não reinicia ao terminar", async () => {
    render(<YouTubeAudioPlayer videoId="dQw4w9WgXcQ" loop={false} />);

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    mockPlayer.seekTo.mockClear();
    mockPlayer.playVideo.mockClear();

    // Simula ENDED
    act(() => {
      playerConfig.events.onStateChange({ data: 0, target: mockPlayer });
    });

    expect(mockPlayer.seekTo).not.toHaveBeenCalled();
    expect(mockPlayer.playVideo).not.toHaveBeenCalled();
  });

  it("unmount chama destroy sem lançar erro", async () => {
    const { unmount } = render(<YouTubeAudioPlayer videoId="dQw4w9WgXcQ" />);

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    unmount();

    expect(mockPlayer.destroy).toHaveBeenCalled();
  });

  it("unmount com destroy falhando não lança erro", async () => {
    mockPlayer.destroy.mockImplementation(() => {
      throw new Error("Destroy failed");
    });

    const { unmount } = render(<YouTubeAudioPlayer videoId="dQw4w9WgXcQ" />);

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(() => unmount()).not.toThrow();
  });
});
