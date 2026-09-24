import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SessionLog } from "../SessionLog";
import type { CampaignLogPayload } from "@/context/SocketContext";
import type { CampaignLog } from "@/types";

let currentIsConnected = true;
let createdHandler: ((payload: CampaignLogPayload) => void) | null = null;
let updatedHandler: ((payload: CampaignLogPayload) => void) | null = null;
const mockBroadcastCampaignLogUpdate = vi.fn();

const mockSubscribeCampaignLogCreated = vi.fn((callback: (payload: CampaignLogPayload) => void) => {
  createdHandler = callback;
  return () => {
    if (createdHandler === callback) {
      createdHandler = null;
    }
  };
});

const mockSubscribeCampaignLogUpdated = vi.fn((callback: (payload: CampaignLogPayload) => void) => {
  updatedHandler = callback;
  return () => {
    if (updatedHandler === callback) {
      updatedHandler = null;
    }
  };
});

vi.mock("@/context/SocketContext", () => ({
  useSocket: () => ({
    get isConnected() {
      return currentIsConnected;
    },
    subscribeCampaignLogCreated: mockSubscribeCampaignLogCreated,
    subscribeCampaignLogUpdated: mockSubscribeCampaignLogUpdated,
    broadcastCampaignLogUpdate: mockBroadcastCampaignLogUpdate,
  }),
}));

const campaignId = "camp-123";

const createMockLog = (
  id: string,
  description: string,
  action = "action_test",
  payload: Record<string, unknown> = {}
): CampaignLog => ({
  id,
  campaignId,
  actorType: "character",
  actorId: "actor-1",
  actorName: "Hero",
  action,
  description,
  payload,
  createdById: "user-1",
  createdAt: new Date("2026-09-21T10:00:00Z"),
});

describe("SessionLog - Realtime and Acceptance Criteria (Issue #13)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    currentIsConnected = true;
    createdHandler = null;
    updatedHandler = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("1. Eliminação do Polling", () => {
    it("chama fetch apenas UMA vez no carregamento inicial e não a cada 4 segundos com timers", async () => {
      vi.useFakeTimers();

      const initialLogs = [createMockLog("log-1", "Primeiro log")];
      const fetchSpy = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: initialLogs }),
        } as Response)
      );
      global.fetch = fetchSpy;

      render(<SessionLog campaignId={campaignId} />);

      // Aguarda o fetch inicial
      await act(async () => {
        await Promise.resolve();
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith(
        `/api/campaigns/${campaignId}/logs?limit=100`,
        expect.objectContaining({ credentials: "include" })
      );

      // Avança 4 segundos (intervalo anterior de polling)
      await act(async () => {
        vi.advanceTimersByTime(4000);
      });
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Avança mais 12 segundos (total 16s, simulando múltiplos ciclos de 4s)
      await act(async () => {
        vi.advanceTimersByTime(12000);
      });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("2. Sincronização em Tempo Real (campaign-log-created)", () => {
    it("ao disparar o callback de subscribeCampaignLogCreated, o novo log aparece imediatamente na tela", async () => {
      const initialLogs = [createMockLog("log-1", "Log existente")];
      global.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: initialLogs }),
        } as Response)
      );

      render(<SessionLog campaignId={campaignId} />);

      await waitFor(() => {
        expect(screen.getByText("Log existente")).toBeInTheDocument();
      });

      expect(createdHandler).not.toBeNull();

      const newLog = createMockLog("log-2", "Novo evento em tempo real!");
      act(() => {
        createdHandler!({
          campaignId,
          log: newLog,
        });
      });

      expect(screen.getByText("Novo evento em tempo real!")).toBeInTheDocument();
    });

    it("deduplicação: se o mesmo log for recebido novamente pelo socket, a lista não duplica registros com o mesmo ID", async () => {
      const initialLogs = [createMockLog("log-1", "Log único")];
      global.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: initialLogs }),
        } as Response)
      );

      render(<SessionLog campaignId={campaignId} />);

      await waitFor(() => {
        expect(screen.getByText("Log único")).toBeInTheDocument();
      });

      expect(createdHandler).not.toBeNull();

      // Dispara evento com log de mesmo id
      const duplicateLog = createMockLog("log-1", "Log único");
      act(() => {
        createdHandler!({
          campaignId,
          log: duplicateLog,
        });
      });

      const items = screen.getAllByText("Log único");
      expect(items).toHaveLength(1);
    });

    it("limite de 100 registros é mantido ao inserir novos logs em tempo real", async () => {
      // 100 logs iniciais
      const hundredLogs: CampaignLog[] = Array.from({ length: 100 }, (_, i) =>
        createMockLog(`init-log-${i}`, `Log número ${i}`)
      );

      global.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: hundredLogs }),
        } as Response)
      );

      render(<SessionLog campaignId={campaignId} />);

      await waitFor(() => {
        expect(screen.getByText("Log número 0")).toBeInTheDocument();
      });

      // Emite novo log via socket
      const overflowLog = createMockLog("overflow-log-1", "Log extra acima de 100");
      act(() => {
        createdHandler!({
          campaignId,
          log: overflowLog,
        });
      });

      expect(screen.getByText("Log extra acima de 100")).toBeInTheDocument();
      // O mais antigo (Log número 99 no final do slice de 100) deve ter sido descartado
      expect(screen.queryByText("Log número 99")).not.toBeInTheDocument();
    });
  });

  describe("3. Atualização em Tempo Real (campaign-log-updated)", () => {
    it("ao disparar o callback de subscribeCampaignLogUpdated com um resultado de rolagem preenchido, o log existente é atualizado em tempo real", async () => {
      const pendingRollLog = createMockLog(
        "roll-log-1",
        "Rolagem pendente",
        "roll_request"
      );

      global.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [pendingRollLog] }),
        } as Response)
      );

      render(<SessionLog campaignId={campaignId} />);

      await waitFor(() => {
        expect(screen.getByText("Rolagem pendente")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Registrar resultado/i })).toBeInTheDocument();
      });

      expect(updatedHandler).not.toBeNull();

      // Dispara atualização em tempo real mudando para roll_result com payload preenchido
      const updatedRollLog = createMockLog(
        "roll-log-1",
        "Rolagem realizada",
        "roll_result",
        { result: 19 }
      );

      act(() => {
        updatedHandler!({
          campaignId,
          log: updatedRollLog,
        });
      });

      expect(screen.getByText("Rolagem realizada")).toBeInTheDocument();
      expect(screen.getByText("Resultado: 19")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Registrar resultado/i })).not.toBeInTheDocument();
    });
  });

  describe("4. Reconciliação ao Reconectar", () => {
    it("quando isConnected transiciona de false para true, loadLogs é chamado novamente para reconciliação", async () => {
      // Inicia desconectado
      currentIsConnected = false;

      const fetchSpy = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [createMockLog("log-1", "Log inicial")] }),
        } as Response)
      );
      global.fetch = fetchSpy;

      const { rerender } = render(<SessionLog campaignId={campaignId} />);

      await waitFor(() => {
        expect(screen.getByText("Log inicial")).toBeInTheDocument();
      });

      // Primeiro fetch realizado na montagem pelo useEffect inicial
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Permanece desconectado e re-renderiza (não deve chamar loadLogs novamente)
      rerender(<SessionLog campaignId={campaignId} />);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Transiciona de false para true e aciona re-render
      currentIsConnected = true;
      rerender(<SessionLog campaignId={campaignId} />);

      // Deve ter chamado loadLogs uma segunda vez para reconciliar
      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledTimes(2);
      });
    });
  });
});
