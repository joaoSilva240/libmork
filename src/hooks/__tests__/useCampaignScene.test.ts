import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useCampaignScene } from "../useCampaignScene";

function makeFakeSocket() {
  const handlers: Record<string, Array<(payload: unknown) => void>> = {};
  return {
    on: vi.fn((event: string, handler: (payload: unknown) => void) => {
      (handlers[event] ||= []).push(handler);
    }),
    off: vi.fn((event: string, handler: (payload: unknown) => void) => {
      handlers[event] = (handlers[event] || []).filter((h) => h !== handler);
    }),
    emit: vi.fn(),
    fire(event: string, payload: unknown) {
      (handlers[event] || []).forEach((h) => h(payload));
    },
    handlerCount(event: string) {
      return (handlers[event] || []).length;
    },
  };
}

describe("useCampaignScene (issue #86, Fase 1)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("inicializa com a cena sanitizada de initialScene", () => {
    const socket = makeFakeSocket();
    const { result } = renderHook(() =>
      useCampaignScene({ campaignId: "c1", initialScene: "combat", socket }),
    );
    expect(result.current.activeScene).toBe("combat");
  });

  it("valor desconhecido vira Livre (null)", () => {
    const socket = makeFakeSocket();
    const { result } = renderHook(() =>
      useCampaignScene({ campaignId: "c1", initialScene: "xyz", socket }),
    );
    expect(result.current.activeScene).toBeNull();
  });

  it("setScene faz PATCH, emite scene-changed e aplica otimista", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    vi.stubGlobal("fetch", fetchMock);
    const socket = makeFakeSocket();

    const { result } = renderHook(() =>
      useCampaignScene({ campaignId: "c1", initialScene: null, socket }),
    );

    await act(async () => {
      await result.current.setScene("interlude");
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/campaigns/c1/scene",
      expect.objectContaining({ method: "PATCH" }),
    );
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body).toEqual({ scene: "interlude", encounterAction: undefined });
    expect(socket.emit).toHaveBeenCalledWith("scene-changed", {
      campaignId: "c1",
      scene: "interlude",
      encounterAction: undefined,
    });
    expect(result.current.activeScene).toBe("interlude");
    expect(result.current.isSaving).toBe(false);
    vi.unstubAllGlobals();
  });

  it("falha no PATCH faz rollback da otimista e seta error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }),
    );
    const socket = makeFakeSocket();
    const { result } = renderHook(() =>
      useCampaignScene({ campaignId: "c1", initialScene: "combat", socket }),
    );

    await act(async () => {
      await result.current.setScene("escape");
    });

    expect(result.current.activeScene).toBe("combat");
    expect(result.current.error).toBe("Não foi possível salvar a cena");
    expect(socket.emit).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("aplica scene-changed da própria campanha e ignora outras", () => {
    const socket = makeFakeSocket();
    const { result } = renderHook(() =>
      useCampaignScene({ campaignId: "c1", initialScene: null, socket }),
    );

    act(() => {
      socket.fire("scene-changed", { campaignId: "c2", scene: "combat" });
    });
    expect(result.current.activeScene).toBeNull();

    act(() => {
      socket.fire("scene-changed", { campaignId: "c1", scene: "stealth" });
    });
    expect(result.current.activeScene).toBe("stealth");
  });

  it("não assina sem campaignId e remove listener no unmount", () => {
    const socket = makeFakeSocket();
    const { result, unmount } = renderHook(() =>
      useCampaignScene({ campaignId: "c1", initialScene: null, socket }),
    );
    expect(socket.handlerCount("scene-changed")).toBe(1);
    unmount();
    expect(socket.handlerCount("scene-changed")).toBe(0);
    expect(result.current.activeScene).toBeNull();
  });
});
