// =============================================================================
// Libmork â€” Audio: Loader singleton do YouTube IFrame API (Issue #60)
// =============================================================================
// Injeta o script oficial do YouTube IFrame API e retorna uma promise que
// resolve quando window.YT estÃ¡ pronto. Chamadas concorrentes compartilham
// a mesma promise (cache em mÃ³dulo).

declare global {
  interface Window {
    YT?: typeof YT;
    onYouTubeIframeAPIReady?: () => void;
  }
  const YT: {
    Player: new (
      elementId: string | HTMLElement,
      config: {
        height?: string;
        width?: string;
        videoId: string;
        playerVars?: Record<string, number | string>;
        events?: {
          onReady?: (event: { target: YTPlayer }) => void;
          onStateChange?: (event: { data: number; target: YTPlayer }) => void;
          onError?: (event: { data: number; target: YTPlayer }) => void;
        };
      },
    ) => YTPlayer;
    PlayerState: {
      UNSTARTED: number;
      ENDED: number;
      PLAYING: number;
      PAUSED: number;
      BUFFERING: number;
      CUED: number;
    };
  };
  interface YTPlayer {
    playVideo(): void;
    pauseVideo(): void;
    setVolume(volume: number): void;
    seekTo(seconds: number, allowSeekAhead: boolean): void;
    destroy(): void;
    loadVideoById(videoId: string): void;
    getPlayerState(): number;
    mute(): void;
    unMute(): void;
  }
}
export {};

let cachedPromise: Promise<typeof YT> | null = null;

/**
 * Carrega o YouTube IFrame API de forma singleton.
 * Se `window.YT?.Player` jÃ¡ existe, resolve imediatamente.
 * Caso contrÃ¡rio, injeta o script e aguarda `onYouTubeIframeAPIReady`.
 * Chamadas concorrentes compartilham a mesma promise.
 */
export function loadYouTubeIframeApi(): Promise<typeof YT> {
  if (cachedPromise) {
    return cachedPromise;
  }

  if (typeof window !== "undefined" && window.YT?.Player) {
    cachedPromise = Promise.resolve(window.YT);
    return cachedPromise;
  }

  cachedPromise = new Promise<typeof YT>((resolve) => {
    const existingCallback = window.onYouTubeIframeAPIReady;

    window.onYouTubeIframeAPIReady = () => {
      if (existingCallback) {
        existingCallback();
      }
      if (window.YT) {
        resolve(window.YT);
      }
    };

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    document.head.appendChild(script);
  });

  return cachedPromise;
}

// FunÃ§Ã£o interna para reset de cache (apenas para testes)
export function __resetCache() {
  cachedPromise = null;
}
