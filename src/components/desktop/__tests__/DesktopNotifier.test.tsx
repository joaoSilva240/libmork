import { render, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import DesktopNotifier from "../DesktopNotifier";
import type { DesktopClientApi } from "../../../../electron/types";
import type {
  DefenseReactionRequestPayload,
  DuelInviteRequestPayload,
  CampaignLogPayload,
} from "@/context/SocketContext";
import type { CombatSessionState } from "@/lib/engine";

let initiativeHandler: ((payload: { campaignId: string }) => void) | null = null;
let combatHandler: ((state: CombatSessionState) => void) | null = null;
let defenseHandler: ((payload: DefenseReactionRequestPayload) => void) | null = null;
let duelHandler: ((payload: DuelInviteRequestPayload) => void) | null = null;
let logHandler: ((payload: CampaignLogPayload) => void) | null = null;

vi.mock("@/context/SocketContext", () => ({
  useSocket: () => ({
    subscribeInitiativeRequest: vi.fn((cb) => {
      initiativeHandler = cb;
      return () => {
        initiativeHandler = null;
      };
    }),
    subscribeCombatState: vi.fn((cb) => {
      combatHandler = cb;
      return () => {
        combatHandler = null;
      };
    }),
    subscribeDefenseRequest: vi.fn((cb) => {
      defenseHandler = cb;
      return () => {
        defenseHandler = null;
      };
    }),
    subscribeDuelInvite: vi.fn((cb) => {
      duelHandler = cb;
      return () => {
        duelHandler = null;
      };
    }),
    subscribeCampaignLogCreated: vi.fn((cb) => {
      logHandler = cb;
      return () => {
        logHandler = null;
      };
    }),
  }),
}));

describe("DesktopNotifier Component (Issue #80)", () => {
  let mockClient: DesktopClientApi;
  let jukeboxPlayCb: (() => void) | null = null;
  let jukeboxMuteCb: (() => void) | null = null;

  beforeEach(() => {
    jukeboxPlayCb = null;
    jukeboxMuteCb = null;
    mockClient = {
      isElectron: true,
      platform: "win32",
      version: "0.1.0",
      sendNotification: vi.fn().mockResolvedValue(true),
      getServerList: vi.fn().mockResolvedValue([]),
      saveServer: vi.fn().mockResolvedValue(undefined),
      removeServer: vi.fn().mockResolvedValue(undefined),
      getActiveServer: vi.fn().mockResolvedValue("http://localhost:3000"),
      setActiveServer: vi.fn().mockResolvedValue(undefined),
      disconnectServer: vi.fn().mockResolvedValue(undefined),
      checkServerHealth: vi.fn().mockResolvedValue({ ok: true }),
      openExternal: vi.fn().mockResolvedValue(undefined),
      minimize: vi.fn(),
      maximize: vi.fn(),
      close: vi.fn(),
      isMaximized: vi.fn().mockResolvedValue(false),
      onJukeboxTogglePlay: vi.fn((cb) => {
        jukeboxPlayCb = cb;
        return () => {};
      }),
      onJukeboxMute: vi.fn((cb) => {
        jukeboxMuteCb = cb;
        return () => {};
      }),
      onUpdateAvailable: vi.fn(() => () => {}),
      onUpdateDownloaded: vi.fn(() => () => {}),
    };
    window.desktopClient = mockClient;
  });

  afterEach(() => {
    delete window.desktopClient;
    vi.restoreAllMocks();
  });

  it("dispara notificações nativas para iniciativa, turno, reação de defesa, duelo e logs", () => {
    render(<DesktopNotifier />);

    act(() => {
      initiativeHandler?.({ campaignId: "camp-1" });
    });

    expect(mockClient.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Iniciativa Solicitada",
        tag: "initiative-camp-1",
      }),
    );

    const combatState: CombatSessionState = {
      id: "combat-1",
      campaignId: "camp-1",
      active: true,
      round: 2,
      currentTurnIndex: 0,
      combatants: [
        {
          id: "char-1",
          name: "Aldebaran",
          type: "character",
          initiative: 18,
          actionsRemaining: 2,
          maxActions: 2,
          hpCurrent: 30,
          hpMax: 30,
          manaCurrent: 10,
          manaMax: 10,
          vigor: 12,
          destreza: 14,
          level: 3,
        },
      ],
      pendingReaction: null,
      logs: [],
    };

    act(() => {
      combatHandler?.(combatState);
    });

    expect(mockClient.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Turno de Aldebaran",
        body: "Rodada 2 — É a vez de Aldebaran agir no combate.",
      }),
    );

    // Mesma chave de turno não deve duplicar notificação
    const callCountBeforeDuplicate = (mockClient.sendNotification as ReturnType<typeof vi.fn>).mock
      .calls.length;
    act(() => {
      combatHandler?.(combatState);
    });
    expect((mockClient.sendNotification as ReturnType<typeof vi.fn>).mock.calls.length).toBe(
      callCountBeforeDuplicate,
    );

    act(() => {
      defenseHandler?.({
        id: "react-1",
        campaignId: "camp-1",
        attackerId: "npc-1",
        attackerName: "Esqueleto Rei",
        targetId: "char-1",
        targetName: "Aldebaran",
        rawDamage: 14,
        attackRoll: 19,
        isPhysical: true,
        actionName: "Lâmina Sombria",
      });
    });

    expect(mockClient.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Solicitação de Reação de Defesa",
        body: expect.stringContaining(
          "Esqueleto Rei atacou Aldebaran com Lâmina Sombria (14 de dano)",
        ),
      }),
    );

    act(() => {
      duelHandler?.({
        campaignId: "camp-1",
        challengerId: "char-2",
        challengerName: "Kael",
        targetCharacterId: "char-1",
        targetCharacterName: "Aldebaran",
        permanentResults: true,
      });
    });

    expect(mockClient.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Convite de Duelo",
        body: expect.stringContaining(
          "Kael desafiou Aldebaran para um duelo (Resultados Permanentes)",
        ),
      }),
    );

    act(() => {
      logHandler?.({
        campaignId: "camp-1",
        log: {
          id: "log-99",
          campaignId: "camp-1",
          actorType: "character",
          actorId: "char-2",
          actorName: "Kael",
          action: "chat",
          description: "Cuidado com a armadilha no corredor!",
          payload: {},
          createdById: "user-2",
          createdAt: new Date(),
        },
      });
    });

    expect(mockClient.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Mensagem da Campanha — Kael",
        body: "Cuidado com a armadilha no corredor!",
      }),
    );
  });

  it("propaga atalhos globais de Jukebox do Electron para CustomEvents na window", () => {
    render(<DesktopNotifier />);

    const playListener = vi.fn();
    const muteListener = vi.fn();
    window.addEventListener("libmork:jukebox-toggle-play", playListener);
    window.addEventListener("libmork:jukebox-mute", muteListener);

    act(() => {
      jukeboxPlayCb?.();
      jukeboxMuteCb?.();
    });

    expect(playListener).toHaveBeenCalledTimes(1);
    expect(muteListener).toHaveBeenCalledTimes(1);

    window.removeEventListener("libmork:jukebox-toggle-play", playListener);
    window.removeEventListener("libmork:jukebox-mute", muteListener);
  });
});
