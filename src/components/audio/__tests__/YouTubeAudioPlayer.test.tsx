// =============================================================================
// Libmork â€” Audio: Testes do YouTubeAudioPlayer (Issue #60)
// =============================================================================

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, waitFor, act } from "@testing-library/react";
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
      getPlayerState: vi.fn(() => -1), // UNSTARTED por padrÃ£o
      mute: vi.fn(),
      unMute: vi.fn(),
    };

    mockYT = {
      Player: vi.fn((element: any, config: any) => {
        playerConfig = config;
        // Simula onReady assÃ­ncrono
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

  it("cria player com configuraÃ§Ã£o correta", async () => {
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

  it("clamp de volume entre 0 e 100", async () => {
    const { rerender } = render(<YouTubeAudioPlayer videoId="dQw4w9WgXcQ" volume={150} />);

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockPlayer.setVolume).toHaveBeenCalledWith(100);

    mockPlayer.setVolume.mockClear();
    rerender(<YouTubeAudioPlayer videoId="dQw4w9WgXcQ" volume={-20} />);

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockPlayer.setVolume).toHaveBeenCalledWith(0);
  });

  it("chama playVideo quando playing=true e estado nÃ£o Ã© PLAYING", async () => {
    mockPlayer.getPlayerState.mockReturnValue(2); // PAUSED

    render(<YouTubeAudioPlayer videoId="dQw4w9WgXcQ" playing={true} />);

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockPlayer.playVideo).toHaveBeenCalled();
  });

  it("chama pauseVideo quando playing=false e estado Ã© PLAYING", async () => {
    mockPlayer.getPlayerState.mockReturnValue(1); // PLAYING

    render(<YouTubeAudioPlayer videoId="dQw4w9WgXcQ" playing={false} />);

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockPlayer.pauseVideo).toHaveBeenCalled();
  });

  it("onStateChange mapeamento correto de estados", async () => {
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

  it("loop=true reinicia vÃ­deo ao terminar", async () => {
    render(<YouTubeAudioPlayer videoId="dQw4w9WgXcQ" loop={true} />);

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Garante que onReady foi chamado (simula manualmente se necessÃ¡rio)
    await act(async () => {
      if (playerConfig.events?.onReady) {
        playerConfig.events.onReady({ target: mockPlayer });
      }
      await vi.runAllTimersAsync();
    });

    // Simula ENDED
    act(() => {
      playerConfig.events.onStateChange({ data: 0, target: mockPlayer });
    });

    expect(mockPlayer.seekTo).toHaveBeenCalledWith(0, true);
    expect(mockPlayer.playVideo).toHaveBeenCalled();
  });

  it("loop=false nÃ£o reinicia ao terminar", async () => {
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

  it("unmount chama destroy sem lanÃ§ar erro", async () => {
    const { unmount } = render(<YouTubeAudioPlayer videoId="dQw4w9WgXcQ" />);

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    unmount();

    expect(mockPlayer.destroy).toHaveBeenCalled();
  });

  it("unmount com destroy falhando nÃ£o lanÃ§a erro", async () => {
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
