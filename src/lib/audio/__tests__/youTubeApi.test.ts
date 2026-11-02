// =============================================================================
// Libmork â€” Audio: Testes do loader do YouTube IFrame API (Issue #60)
// =============================================================================

import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadYouTubeIframeApi, __resetCache } from "../youTubeApi";

describe("loadYouTubeIframeApi", () => {
  beforeEach(() => {
    // Limpa window.YT e onYouTubeIframeAPIReady
    delete (window as any).YT;
    delete (window as any).onYouTubeIframeAPIReady;

    // Limpa scripts injetados
    document.querySelectorAll('script[src*="youtube.com/iframe_api"]').forEach((el) => el.remove());

    // Reseta cache interno do mÃ³dulo
    __resetCache();
  });

  it("resolve imediatamente se window.YT.Player jÃ¡ existe", async () => {
    const mockYT = {
      Player: vi.fn(),
      PlayerState: { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
    };
    (window as any).YT = mockYT;

    const result = await loadYouTubeIframeApi();
    expect(result).toBe(mockYT);
    
    // NÃ£o deve injetar script
    const scripts = document.querySelectorAll('script[src*="youtube.com/iframe_api"]');
    expect(scripts.length).toBe(0);
  });

  it("injeta script e resolve quando onYouTubeIframeAPIReady dispara", async () => {
    const mockYT = {
      Player: vi.fn(),
      PlayerState: { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
    };

    const promise = loadYouTubeIframeApi();

    // Deve ter injetado o script
    const script = document.querySelector('script[src="https://www.youtube.com/iframe_api"]') as HTMLScriptElement | null;
    expect(script).toBeTruthy();
    expect(script?.src).toBe("https://www.youtube.com/iframe_api");

    // Simula carregamento do script
    (window as any).YT = mockYT;
    window.onYouTubeIframeAPIReady?.();

    const result = await promise;
    expect(result).toBe(mockYT);
  });

  it("preserva callback onYouTubeIframeAPIReady prÃ©-existente", async () => {
    const existingCallback = vi.fn();
    window.onYouTubeIframeAPIReady = existingCallback;

    const mockYT = {
      Player: vi.fn(),
      PlayerState: { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
    };

    const promise = loadYouTubeIframeApi();

    // Simula carregamento
    (window as any).YT = mockYT;
    window.onYouTubeIframeAPIReady?.();

    await promise;

    expect(existingCallback).toHaveBeenCalledTimes(1);
  });

  it("chamadas concorrentes compartilham a mesma promise", async () => {
    const mockYT = {
      Player: vi.fn(),
      PlayerState: { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 },
    };

    const promise1 = loadYouTubeIframeApi();
    const promise2 = loadYouTubeIframeApi();
    const promise3 = loadYouTubeIframeApi();

    // Todas devem ser a mesma referÃªncia
    expect(promise1).toBe(promise2);
    expect(promise2).toBe(promise3);

    // Deve ter injetado apenas um script
    const scripts = document.querySelectorAll('script[src="https://www.youtube.com/iframe_api"]');
    expect(scripts.length).toBe(1);

    // Simula carregamento
    (window as any).YT = mockYT;
    window.onYouTubeIframeAPIReady?.();

    const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);
    expect(result1).toBe(mockYT);
    expect(result2).toBe(mockYT);
    expect(result3).toBe(mockYT);
  });
});
