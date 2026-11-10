import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SessionLaunchModal } from "../SessionLaunchModal";

const CAMPAIGN_UUID = "550e8400-e29b-41d4-a716-446655440000";

const firstSessionContext = {
  success: true,
  data: { isFirstSession: true, oneShot: null, maxPlayers: null, enrolledPlayers: [] },
};

const continuingContext = {
  success: true,
  data: {
    isFirstSession: false,
    oneShot: false,
    maxPlayers: 5,
    enrolledPlayers: [{ userId: "u-2", displayName: "Maria", characterName: "Artemis" }],
  },
};

const launchedSession = {
  id: "s-1",
  campaignId: CAMPAIGN_UUID,
  campaignName: "Strahd",
  coverImageUrl: null,
  masterId: "m-1",
  masterName: "João",
  masterAvatar: null,
  description: "Sessão de abertura em Barovia",
  proposedStart: "2026-12-01T03:00:00.000Z",
  proposedEnd: "2026-12-04T02:59:59.000Z",
  scheduledAt: null,
  durationMinutes: 240,
  xpReward: null,
  sessionType: "one_shot",
  maxSlots: 4,
  acceptedCount: 0,
  interestedCount: 0,
  remainingSlots: 4,
  status: "proposed",
  userApplication: null,
  createdAt: new Date().toISOString(),
};

let contextResponse: unknown = firstSessionContext;
let postSpy = vi.fn();

function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/api/campaigns/") && url.includes("/session-context")) {
        return Promise.resolve({ ok: true, json: async () => contextResponse });
      }
      if (url.includes("/api/campaigns")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [{ id: CAMPAIGN_UUID, name: "Strahd" }],
          }),
        });
      }
      if (url.includes("/api/sessions")) {
        postSpy(url, init);
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: launchedSession }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
    }),
  );
}

async function openModalAndSelectCampaign(onLaunched = vi.fn()) {
  const onClose = vi.fn();
  render(<SessionLaunchModal isOpen onClose={onClose} onLaunched={onLaunched} />);
  const select = await screen.findByTestId("launch-campaign-select");
  fireEvent.change(select, { target: { value: CAMPAIGN_UUID } });
  await waitFor(() => expect(screen.queryByText("Carregando contexto...")).not.toBeInTheDocument());
  return { onClose, onLaunched };
}

describe("SessionLaunchModal", () => {
  beforeEach(() => {
    contextResponse = firstSessionContext;
    postSpy = vi.fn();
    stubFetch();
  });

  afterEach(() => vi.unstubAllGlobals());

  it("mostra tipo e vagas obrigatórios na primeira sessão", async () => {
    await openModalAndSelectCampaign();
    expect(screen.getByTestId("launch-type-one-shot")).toBeInTheDocument();
    expect(screen.getByTestId("launch-type-continuing")).toBeInTheDocument();
    expect(screen.getByTestId("launch-max-slots")).toBeInTheDocument();
  });

  it("herda configuração e lista inscritos em campanha continuada", async () => {
    contextResponse = continuingContext;
    await openModalAndSelectCampaign();
    expect(screen.queryByTestId("launch-type-one-shot")).not.toBeInTheDocument();
    expect(screen.queryByTestId("launch-max-slots")).not.toBeInTheDocument();
    expect(screen.getByText(/Campanha continuada/i)).toBeInTheDocument();
    expect(screen.getByText(/5 vagas/i)).toBeInTheDocument();
    expect(screen.getByText("Maria")).toBeInTheDocument();
    expect(screen.getByText("Artemis")).toBeInTheDocument();
  });

  it("envia POST com datas convertidas e chama onLaunched", async () => {
    const { onLaunched } = await openModalAndSelectCampaign();

    fireEvent.change(screen.getByTestId("launch-description"), {
      target: { value: "Sessão de abertura em Barovia" },
    });
    fireEvent.change(screen.getByTestId("launch-start-date"), {
      target: { value: "2026-12-01" },
    });
    fireEvent.change(screen.getByTestId("launch-end-date"), {
      target: { value: "2026-12-03" },
    });
    fireEvent.change(screen.getByTestId("launch-max-slots"), { target: { value: "4" } });

    fireEvent.click(screen.getByTestId("launch-submit"));

    await waitFor(() => expect(postSpy).toHaveBeenCalled());
    const [url, init] = postSpy.mock.calls[0];
    expect(url).toBe("/api/sessions");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      campaignId: CAMPAIGN_UUID,
      description: "Sessão de abertura em Barovia",
      sessionType: "one_shot",
      maxSlots: 4,
    });
    expect(body.proposedStart).toBe(new Date("2026-12-01T00:00:00").toISOString());
    expect(body.proposedEnd).toBe(new Date("2026-12-03T23:59:59").toISOString());
    expect(onLaunched).toHaveBeenCalledWith(launchedSession);
  });

  it("bloqueia submit com descrição curta e não faz POST", async () => {
    await openModalAndSelectCampaign();
    fireEvent.change(screen.getByTestId("launch-description"), {
      target: { value: "curta" },
    });
    fireEvent.change(screen.getByTestId("launch-start-date"), {
      target: { value: "2026-12-01" },
    });
    fireEvent.change(screen.getByTestId("launch-end-date"), {
      target: { value: "2026-12-03" },
    });

    fireEvent.click(screen.getByTestId("launch-submit"));

    await waitFor(() => expect(screen.getByText(/mínimo de 10 caracteres/i)).toBeInTheDocument());
    expect(postSpy).not.toHaveBeenCalled();
  });
});
