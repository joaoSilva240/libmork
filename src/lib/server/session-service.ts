// =============================================================================
// Libmork — Serviço de Sessões Agendadas e Matchmaking (Issue #63)
// =============================================================================

import { db } from "@/lib/db";
import {
  campaigns,
  campaignSessions,
  sessionCandidates,
  characters,
  characterCampaigns,
  users,
} from "@/lib/db/schema";
import { eq, and, ne, desc, sql, gte } from "drizzle-orm";
import { eachDayISO } from "@/lib/utils/session-dates";
import type { LaunchSessionInput, ApplySessionInput } from "@/lib/validators/sessions";

export type SessionStatus = "proposed" | "confirmed" | "cancelled";
export type SessionType = "one_shot" | "continuing";

export type SessionSummary = {
  id: string;
  campaignId: string;
  campaignName: string;
  coverImageUrl: string | null;
  masterId: string;
  masterName: string;
  masterAvatar: string | null;
  description: string;
  proposedStart: string;
  proposedEnd: string;
  scheduledAt: string | null;
  durationMinutes: number;
  xpReward: number | null;
  sessionType: SessionType;
  maxSlots: number;
  acceptedCount: number;
  interestedCount: number;
  remainingSlots: number;
  status: SessionStatus;
  userApplication: {
    status: "interested" | "accepted" | "rejected";
    availableDays: string[];
    allDay: boolean;
    preferredStart: string | null;
    preferredEnd: string | null;
    characterId: string | null;
  } | null;
  createdAt: string;
};

export type CandidateDetail = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  characterId: string | null;
  characterName: string | null;
  availableDays: string[];
  preferredStart: string | null;
  preferredEnd: string | null;
  allDay: boolean;
  status: "interested" | "accepted" | "rejected";
  appliedAt: string;
};

export type EnrolledPlayer = {
  userId: string;
  displayName: string;
  characterName: string;
};

export type SessionContext = {
  isFirstSession: boolean;
  oneShot: boolean | null;
  maxPlayers: number | null;
  enrolledPlayers: EnrolledPlayer[];
};

export type PlayerCalendarEntry = {
  sessionId: string;
  campaignId: string;
  campaignName: string;
  coverImageUrl: string | null;
  description: string;
  scheduledAt: string;
  durationMinutes: number;
  sessionType: SessionType;
  xpReward: number | null;
};

/**
 * Valida que a campanha existe e pertence ao mestre.
 */
async function requireCampaignMaster(campaignId: string, masterId: string) {
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId)).limit(1);
  if (!campaign) {
    throw new Error("Campanha não encontrada");
  }
  if (campaign.masterId !== masterId) {
    throw new Error("Apenas o Mestre pode gerenciar sessões desta campanha");
  }
  return campaign;
}

/**
 * Valida que a sessão existe e pertence ao mestre.
 */
async function requireSessionMaster(sessionId: string, masterId: string) {
  const [row] = await db
    .select()
    .from(campaignSessions)
    .where(eq(campaignSessions.id, sessionId))
    .limit(1);
  if (!row) {
    throw new Error("Sessão não encontrada");
  }
  if (row.masterId !== masterId) {
    throw new Error("Apenas o Mestre pode gerenciar sessões desta campanha");
  }
  return row;
}

/**
 * Monta o resumo público de uma sessão, com contagens de candidatos e a
 * candidatura do usuário visualizador (se houver).
 */
async function buildSummary(
  row: typeof campaignSessions.$inferSelect,
  viewerId?: string,
): Promise<SessionSummary> {
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, row.campaignId))
    .limit(1);

  const [master] = await db
    .select({
      displayName: users.displayName,
      masterName: users.masterName,
      masterAvatar: users.masterAvatar,
    })
    .from(users)
    .where(eq(users.id, row.masterId))
    .limit(1);

  const candidates = await db
    .select()
    .from(sessionCandidates)
    .where(eq(sessionCandidates.sessionId, row.id));

  const acceptedCount = candidates.filter((c) => c.status === "accepted").length;
  const interestedCount = candidates.filter((c) => c.status === "interested").length;
  const mine = viewerId ? candidates.find((c) => c.userId === viewerId) : undefined;

  return {
    id: row.id,
    campaignId: row.campaignId,
    campaignName: campaign?.name ?? "Campanha",
    coverImageUrl: campaign?.coverImageUrl ?? null,
    masterId: row.masterId,
    masterName: master?.masterName || master?.displayName || "Mestre",
    masterAvatar: master?.masterAvatar ?? null,
    description: row.description,
    proposedStart: row.proposedStart.toISOString(),
    proposedEnd: row.proposedEnd.toISOString(),
    scheduledAt: row.scheduledAt ? row.scheduledAt.toISOString() : null,
    durationMinutes: row.durationMinutes,
    xpReward: row.xpReward,
    sessionType: row.sessionType as SessionType,
    maxSlots: row.maxSlots,
    acceptedCount,
    interestedCount,
    remainingSlots: Math.max(0, row.maxSlots - acceptedCount),
    status: row.status as SessionStatus,
    userApplication: mine
      ? {
          status: mine.status as "interested" | "accepted" | "rejected",
          availableDays: (mine.availableDays ?? []) as string[],
          allDay: mine.allDay,
          preferredStart: mine.preferredStart,
          preferredEnd: mine.preferredEnd,
          characterId: mine.characterId,
        }
      : null,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Monta o detalhe público de uma candidatura.
 */
async function buildCandidateDetail(
  row: typeof sessionCandidates.$inferSelect,
): Promise<CandidateDetail> {
  const [user] = await db
    .select({ displayName: users.displayName, masterAvatar: users.masterAvatar })
    .from(users)
    .where(eq(users.id, row.userId))
    .limit(1);

  let characterName: string | null = null;
  if (row.characterId) {
    const [ch] = await db
      .select({ name: characters.name })
      .from(characters)
      .where(eq(characters.id, row.characterId))
      .limit(1);
    characterName = ch?.name ?? null;
  }

  return {
    userId: row.userId,
    displayName: user?.displayName || "Jogador",
    avatarUrl: user?.masterAvatar ?? null,
    characterId: row.characterId,
    characterName,
    availableDays: (row.availableDays ?? []) as string[],
    preferredStart: row.preferredStart,
    preferredEnd: row.preferredEnd,
    allDay: row.allDay,
    status: row.status as "interested" | "accepted" | "rejected",
    appliedAt: row.appliedAt.toISOString(),
  };
}

/**
 * Jogadores já inscritos na campanha (personagens aprovados, deduplicados por dono).
 */
export async function getEnrolledPlayers(campaignId: string): Promise<EnrolledPlayer[]> {
  const rows = await db
    .select({
      userId: characters.ownerId,
      displayName: users.displayName,
      characterName: characters.name,
    })
    .from(characterCampaigns)
    .innerJoin(characters, eq(characterCampaigns.characterId, characters.id))
    .innerJoin(users, eq(characters.ownerId, users.id))
    .where(
      and(
        eq(characterCampaigns.campaignId, campaignId),
        eq(characterCampaigns.approvalStatus, "approved"),
      ),
    );

  const seen = new Set<string>();
  const result: EnrolledPlayer[] = [];
  for (const r of rows) {
    if (!seen.has(r.userId)) {
      seen.add(r.userId);
      result.push({
        userId: r.userId,
        displayName: r.displayName || "Jogador",
        characterName: r.characterName,
      });
    }
  }
  return result;
}

/**
 * Contexto para o formulário de lançamento: 1ª sessão? tipo/vagas herdados? inscritos?
 */
export async function getSessionContext(
  campaignId: string,
  masterId: string,
): Promise<SessionContext> {
  const campaign = await requireCampaignMaster(campaignId, masterId);

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(campaignSessions)
    .where(
      and(eq(campaignSessions.campaignId, campaignId), ne(campaignSessions.status, "cancelled")),
    );

  return {
    isFirstSession: Number(countRow?.count ?? 0) === 0,
    oneShot: campaign.oneShot,
    maxPlayers: campaign.maxPlayers,
    enrolledPlayers: await getEnrolledPlayers(campaignId),
  };
}

/**
 * Lança uma sessão. Na 1ª sessão (ou campanha legada sem configuração),
 * exige tipo e vagas e persiste em campaigns. Em campanha continuada,
 * inscritos viram candidatos aceitos automaticamente (até o limite de vagas).
 */
export async function launchSession(
  masterId: string,
  input: LaunchSessionInput,
): Promise<SessionSummary> {
  const campaign = await requireCampaignMaster(input.campaignId, masterId);

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(campaignSessions)
    .where(
      and(eq(campaignSessions.campaignId, campaign.id), ne(campaignSessions.status, "cancelled")),
    );
  const isFirstSession = Number(countRow?.count ?? 0) === 0;
  const needsConfig = isFirstSession || campaign.oneShot === null || campaign.maxPlayers === null;

  if (needsConfig && (!input.sessionType || !input.maxSlots)) {
    throw new Error("Tipo de sessão e vagas são obrigatórios na primeira sessão");
  }

  const sessionType: SessionType = needsConfig
    ? (input.sessionType as SessionType)
    : campaign.oneShot
      ? "one_shot"
      : "continuing";
  const maxSlots = needsConfig ? (input.maxSlots as number) : (campaign.maxPlayers as number);

  const created = await db.transaction(async (tx) => {
    if (needsConfig) {
      await tx
        .update(campaigns)
        .set({ oneShot: sessionType === "one_shot", maxPlayers: maxSlots, updatedAt: new Date() })
        .where(eq(campaigns.id, campaign.id));
    }

    const [row] = await tx
      .insert(campaignSessions)
      .values({
        campaignId: campaign.id,
        masterId,
        description: input.description,
        proposedStart: new Date(input.proposedStart),
        proposedEnd: new Date(input.proposedEnd),
        xpReward: input.xpReward ?? null,
        sessionType,
        maxSlots,
        status: "proposed",
      })
      .returning();

    if (sessionType === "continuing") {
      const enrolled = await getEnrolledPlayers(campaign.id);
      const toAccept = enrolled.filter((p) => p.userId !== masterId).slice(0, maxSlots);
      if (toAccept.length > 0) {
        await tx
          .insert(sessionCandidates)
          .values(
            toAccept.map((p) => ({
              sessionId: row.id,
              userId: p.userId,
              availableDays: [],
              allDay: true,
              status: "accepted",
            })),
          )
          .onConflictDoNothing();
      }
    }

    return row;
  });

  return buildSummary(created, masterId);
}

/**
 * Todas as sessões das campanhas do mestre (para o calendário).
 */
export async function listMasterSessions(masterId: string): Promise<SessionSummary[]> {
  const rows = await db
    .select()
    .from(campaignSessions)
    .where(eq(campaignSessions.masterId, masterId))
    .orderBy(desc(campaignSessions.proposedStart));

  const summaries: SessionSummary[] = [];
  for (const row of rows) {
    summaries.push(await buildSummary(row, masterId));
  }
  return summaries;
}

/**
 * Feed público de convites: sessões propostas com período aberto e vagas restantes.
 */
export async function getSessionFeed(userId: string, page = 1) {
  const limit = 20;
  const rows = await db
    .select()
    .from(campaignSessions)
    .where(and(eq(campaignSessions.status, "proposed"), gte(campaignSessions.proposedEnd, new Date())))
    .orderBy(campaignSessions.proposedStart)
    .limit(limit + 1)
    .offset((page - 1) * limit);

  const items: SessionSummary[] = [];
  for (const row of rows.slice(0, limit)) {
    const summary = await buildSummary(row, userId);
    if (summary.remainingSlots > 0) {
      items.push(summary);
    }
  }
  return { items, page, hasMore: rows.length > limit };
}

/**
 * Detalhe de uma sessão para o visualizador (mestre ou jogador).
 */
export async function getSessionDetail(sessionId: string, userId: string): Promise<SessionSummary> {
  const [row] = await db
    .select()
    .from(campaignSessions)
    .where(eq(campaignSessions.id, sessionId))
    .limit(1);
  if (!row) {
    throw new Error("Sessão não encontrada");
  }
  return buildSummary(row, userId);
}

/**
 * Candidatura de jogador (upsert): dias filtrados para o período proposto,
 * horário opcional com fallback "Livre o dia todo". Checa vagas com FOR UPDATE.
 */
export async function applyToSession(
  sessionId: string,
  userId: string,
  input: ApplySessionInput,
): Promise<CandidateDetail> {
  const result = await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(campaignSessions)
      .where(eq(campaignSessions.id, sessionId))
      .for("update")
      .limit(1);

    if (!row) {
      throw new Error("Sessão não encontrada");
    }
    if (row.status !== "proposed") {
      throw new Error("Esta sessão não está mais aberta a candidaturas");
    }
    if (row.masterId === userId) {
      throw new Error("O mestre não pode candidatar-se à própria sessão");
    }

    const accepted = await tx
      .select({ id: sessionCandidates.id })
      .from(sessionCandidates)
      .where(and(eq(sessionCandidates.sessionId, sessionId), eq(sessionCandidates.status, "accepted")));

    const [existing] = await tx
      .select()
      .from(sessionCandidates)
      .where(and(eq(sessionCandidates.sessionId, sessionId), eq(sessionCandidates.userId, userId)))
      .limit(1);

    if (accepted.length >= row.maxSlots && existing?.status !== "accepted") {
      throw new Error("Vagas esgotadas");
    }

    const validDays = new Set(eachDayISO(row.proposedStart, row.proposedEnd));
    const days = input.availableDays.filter((d) => validDays.has(d));
    if (days.length === 0) {
      throw new Error("Selecione ao menos um dia disponível");
    }

    const allDay = !input.preferredStart || !input.preferredEnd;
    const values = {
      characterId: input.characterId ?? null,
      availableDays: days,
      preferredStart: allDay ? null : input.preferredStart,
      preferredEnd: allDay ? null : input.preferredEnd,
      allDay,
      status: "interested",
      appliedAt: new Date(),
    };

    const [upserted] = await tx
      .insert(sessionCandidates)
      .values({ sessionId, userId, ...values })
      .onConflictDoUpdate({
        target: [sessionCandidates.sessionId, sessionCandidates.userId],
        set: values,
      })
      .returning();

    return upserted;
  });

  return buildCandidateDetail(result);
}

/**
 * Panorama de candidaturas (somente o mestre da sessão).
 */
export async function listSessionCandidates(
  sessionId: string,
  masterId: string,
): Promise<CandidateDetail[]> {
  await requireSessionMaster(sessionId, masterId);

  const rows = await db
    .select()
    .from(sessionCandidates)
    .where(eq(sessionCandidates.sessionId, sessionId))
    .orderBy(sessionCandidates.appliedAt);

  const details: CandidateDetail[] = [];
  for (const row of rows) {
    details.push(await buildCandidateDetail(row));
  }
  return details;
}

/**
 * Aceita/rejeita candidatura (somente o mestre). Aceite respeita vagas com FOR UPDATE.
 */
export async function decideCandidate(
  sessionId: string,
  masterId: string,
  candidateUserId: string,
  decision: "accepted" | "rejected",
): Promise<CandidateDetail> {
  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(campaignSessions)
      .where(eq(campaignSessions.id, sessionId))
      .for("update")
      .limit(1);

    if (!row) {
      throw new Error("Sessão não encontrada");
    }
    if (row.masterId !== masterId) {
      throw new Error("Apenas o Mestre pode gerenciar sessões desta campanha");
    }

    const [candidate] = await tx
      .select()
      .from(sessionCandidates)
      .where(
        and(eq(sessionCandidates.sessionId, sessionId), eq(sessionCandidates.userId, candidateUserId)),
      )
      .limit(1);

    if (!candidate) {
      throw new Error("Candidatura não encontrada");
    }

    if (decision === "accepted" && candidate.status !== "accepted") {
      const accepted = await tx
        .select({ id: sessionCandidates.id })
        .from(sessionCandidates)
        .where(
          and(eq(sessionCandidates.sessionId, sessionId), eq(sessionCandidates.status, "accepted")),
        );
      if (accepted.length >= row.maxSlots) {
        throw new Error("Vagas esgotadas");
      }
    }

    const [u] = await tx
      .update(sessionCandidates)
      .set({ status: decision })
      .where(
        and(eq(sessionCandidates.sessionId, sessionId), eq(sessionCandidates.userId, candidateUserId)),
      )
      .returning();

    return u;
  });

  return buildCandidateDetail(updated);
}

/**
 * Bate o martelo: confirma a sessão numa data/hora dentro do período proposto
 * e rejeita automaticamente os candidatos ainda "interested".
 */
export async function confirmSession(
  sessionId: string,
  masterId: string,
  scheduledAt: string,
  durationMinutes = 240,
): Promise<SessionSummary> {
  const row = await db.transaction(async (tx) => {
    const [s] = await tx
      .select()
      .from(campaignSessions)
      .where(eq(campaignSessions.id, sessionId))
      .for("update")
      .limit(1);

    if (!s) {
      throw new Error("Sessão não encontrada");
    }
    if (s.masterId !== masterId) {
      throw new Error("Apenas o Mestre pode gerenciar sessões desta campanha");
    }
    if (s.status !== "proposed") {
      throw new Error("Sessão já confirmada ou cancelada");
    }

    const when = new Date(scheduledAt);
    if (when < s.proposedStart || when > s.proposedEnd) {
      throw new Error("Data final fora do período proposto");
    }

    const [updated] = await tx
      .update(campaignSessions)
      .set({ status: "confirmed", scheduledAt: when, durationMinutes, updatedAt: new Date() })
      .where(eq(campaignSessions.id, sessionId))
      .returning();

    await tx
      .update(sessionCandidates)
      .set({ status: "rejected" })
      .where(
        and(eq(sessionCandidates.sessionId, sessionId), eq(sessionCandidates.status, "interested")),
      );

    return updated;
  });

  return buildSummary(row, masterId);
}

/**
 * Cancela uma sessão (idempotente para já canceladas).
 */
export async function cancelSession(sessionId: string, masterId: string): Promise<void> {
  const row = await requireSessionMaster(sessionId, masterId);
  if (row.status === "cancelled") {
    return;
  }
  await db
    .update(campaignSessions)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(campaignSessions.id, sessionId));
}

/**
 * Calendário pessoal do jogador: somente sessões confirmadas em que foi aceito.
 */
export async function listPlayerCalendar(userId: string): Promise<PlayerCalendarEntry[]> {
  const rows = await db
    .select({ session: campaignSessions, campaign: campaigns })
    .from(sessionCandidates)
    .innerJoin(campaignSessions, eq(sessionCandidates.sessionId, campaignSessions.id))
    .innerJoin(campaigns, eq(campaignSessions.campaignId, campaigns.id))
    .where(
      and(
        eq(sessionCandidates.userId, userId),
        eq(sessionCandidates.status, "accepted"),
        eq(campaignSessions.status, "confirmed"),
      ),
    )
    .orderBy(campaignSessions.scheduledAt);

  return rows
    .filter((r) => r.session.scheduledAt !== null)
    .map((r) => ({
      sessionId: r.session.id,
      campaignId: r.campaign.id,
      campaignName: r.campaign.name,
      coverImageUrl: r.campaign.coverImageUrl,
      description: r.session.description,
      scheduledAt: (r.session.scheduledAt as Date).toISOString(),
      durationMinutes: r.session.durationMinutes,
      sessionType: r.session.sessionType as SessionType,
      xpReward: r.session.xpReward,
    }));
}
