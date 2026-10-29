// =============================================================================
// Libmork — Sistema MISSING — Edição ZERO: Camada de Serviços de Domínio
// Horror Analógico, Mascaramento Seguro da Voz e Ledger de Ações
// =============================================================================

import { db } from "@/lib/db";
import {
  campaigns,
  campaignInvites,
  missingCampaignStates,
  missingHabitants,
  missingActionLedger,
  characterCampaigns,
  characters,
} from "@/lib/db/schema";
import { eq, and, asc, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { ZodError } from "zod";
import { NextResponse } from "next/server";
import {
  calculateErasuresOnLoss,
  canDeclareEpiphany,
  checkHabitantDisappearance,
  resolveForcedTest,
  resolveTest,
  roll1d6,
  roll2d6,
  validateSceneDanger,
} from "../systems/missing/rules";
import {
  createClueSchema,
  createConnectionSchema,
  createHabitantSchema,
  declareEpiphanySchema,
  testRollSchema,
  updateHabitantSchema,
  type CreateClueInput,
  type CreateConnectionInput,
  type CreateHabitantInput,
  type DeclareEpiphanyInput,
  type TestRollInput,
  type UpdateHabitantInput,
} from "../systems/missing/validators";
import type {
  EpiphanyRecord,
  ForcedTestResult,
  HabitantLine,
  InvestigationConnection,
  LedgerEventType,
  MissingCampaignState,
  MissingClue,
  MissingEquipment,
  MissingHabitant,
  MissingScene,
  MissingThreat,
  Role,
  TestResult,
} from "../systems/missing/types";

// =============================================================================
// Helper: Determina campanha e papel do usuário (A Voz vs Redator)
// =============================================================================

export async function getCampaignAndRole(
  campaignId: string,
  userId: string,
): Promise<{ campaign: typeof campaigns.$inferSelect | null; role: Role | null }> {
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .limit(1);

  if (!campaign) {
    return { campaign: null, role: null };
  }

  if (campaign.masterId === userId) {
    return { campaign, role: "voice" };
  }

  // Verifica se o usuário possui convite ativo na campanha
  const [invite] = await db
    .select()
    .from(campaignInvites)
    .where(
      and(
        eq(campaignInvites.campaignId, campaignId),
        eq(campaignInvites.userId, userId),
        eq(campaignInvites.revoked, false),
      ),
    )
    .limit(1);

  if (invite) {
    return { campaign, role: "writer" };
  }

  // Verifica se o usuário já possui habitante na campanha
  const [habitant] = await db
    .select()
    .from(missingHabitants)
    .where(
      and(
        eq(missingHabitants.campaignId, campaignId),
        eq(missingHabitants.ownerId, userId),
      ),
    )
    .limit(1);

  if (habitant) {
    return { campaign, role: "writer" };
  }

  // Verifica se possui personagem vinculado à campanha
  const [link] = await db
    .select()
    .from(characterCampaigns)
    .innerJoin(characters, eq(characterCampaigns.characterId, characters.id))
    .where(
      and(
        eq(characterCampaigns.campaignId, campaignId),
        eq(characters.ownerId, userId),
      ),
    )
    .limit(1);

  if (link) {
    return { campaign, role: "writer" };
  }

  return { campaign, role: null };
}

// =============================================================================
// Helper: Registro no Action Ledger
// =============================================================================

async function recordLedgerEvent(params: {
  campaignId: string;
  habitantId?: string;
  actorRole: Role;
  actorId: string;
  eventType: LedgerEventType;
  payload: Record<string, unknown>;
}) {
  const { campaignId, habitantId, actorRole, actorId, eventType, payload } = params;

  await db.insert(missingActionLedger).values({
    campaignId,
    habitantId: habitantId || null,
    actorRole,
    actorId,
    eventType,
    payload,
  });
}

// =============================================================================
// 1. Obter ou Criar Estado da Campanha
// =============================================================================

export async function getOrCreateCampaignState(campaignId: string): Promise<MissingCampaignState> {
  const [existing] = await db
    .select()
    .from(missingCampaignStates)
    .where(eq(missingCampaignStates.campaignId, campaignId))
    .limit(1);

  if (existing) {
    return {
      id: existing.id,
      campaignId: existing.campaignId,
      activeScene: existing.activeScene as MissingScene,
      cluesBank: existing.cluesBank as MissingClue[],
      investigationWeb: existing.investigationWeb as { connections: InvestigationConnection[] },
      epiphanyHistory: existing.epiphanyHistory as EpiphanyRecord[],
      createdAt: existing.createdAt.toISOString(),
      updatedAt: existing.updatedAt.toISOString(),
    };
  }

  const defaultScene: MissingScene = {
    id: randomUUID(),
    campaignId,
    title: "Cena Inicial",
    isActive: true,
    threats: [],
  };

  const [inserted] = await db
    .insert(missingCampaignStates)
    .values({
      campaignId,
      activeScene: defaultScene,
      cluesBank: [],
      investigationWeb: { connections: [] },
      epiphanyHistory: [],
    })
    .returning();

  return {
    id: inserted.id,
    campaignId: inserted.campaignId,
    activeScene: inserted.activeScene as MissingScene,
    cluesBank: inserted.cluesBank as MissingClue[],
    investigationWeb: inserted.investigationWeb as { connections: InvestigationConnection[] },
    epiphanyHistory: inserted.epiphanyHistory as EpiphanyRecord[],
    createdAt: inserted.createdAt.toISOString(),
    updatedAt: inserted.updatedAt.toISOString(),
  };
}

// =============================================================================
// 2. Estado Sanitizado da Campanha (Mascaramento Seguro Voz vs Redator)
// =============================================================================

export async function getSanitizedCampaignState(
  campaignId: string,
  userId: string,
): Promise<MissingCampaignState> {
  const { campaign, role } = await getCampaignAndRole(campaignId, userId);

  if (!campaign) {
    throw new Error("Campanha não encontrada");
  }

  if (!role) {
    throw new Error("Acesso não autorizado à campanha");
  }

  const rawState = await getOrCreateCampaignState(campaignId);

  // A Voz enxerga o estado completo, com todas as pistas e segredos
  if (role === "voice") {
    return {
      ...rawState,
      role: "voice",
    };
  }

  // Redator: Pistas com isFalseClue: true NUNCA devem ter o status revelado
  // Pistas privadas não distribuídas ou entregues a outro habitante NÃO devem ser enviadas
  const myHabitants = await db
    .select()
    .from(missingHabitants)
    .where(
      and(
        eq(missingHabitants.campaignId, campaignId),
        eq(missingHabitants.ownerId, userId),
      ),
    );

  const myHabitantIds = new Set(myHabitants.map((h) => h.id));

  const sanitizedClues: MissingClue[] = (rawState.cluesBank || [])
    .filter((clue) => clue.deliveredToHabitantId !== null && myHabitantIds.has(clue.deliveredToHabitantId))
    .map((clue) => ({
      ...clue,
      isFalseClue: false, // Mascaramento de segurança estrita
    }));

  return {
    ...rawState,
    cluesBank: sanitizedClues,
    role: "writer",
  };
}

// =============================================================================
// 3. Criar Habitante
// =============================================================================

export async function createHabitant(
  campaignId: string | null | undefined,
  userId: string,
  data: CreateHabitantInput,
): Promise<MissingHabitant> {
  const validated = createHabitantSchema.parse(data);
  const rawCampaignId =
    (typeof campaignId === "string" ? campaignId.trim() : campaignId) ||
    (typeof validated.campaignId === "string" ? validated.campaignId.trim() : validated.campaignId);
  const targetCampaignId: string | null = rawCampaignId ? rawCampaignId : null;

  if (targetCampaignId) {
    const { campaign, role } = await getCampaignAndRole(targetCampaignId, userId);
    if (!campaign) {
      throw new Error("Campanha não encontrada");
    }
    if (!role) {
      throw new Error("Acesso não autorizado à campanha");
    }
  }

  const lines: HabitantLine[] = validated.lines.map((text, index) => ({
    id: randomUUID(),
    index: index + 1,
    text,
    isErased: false,
  }));

  const equipments: [MissingEquipment, MissingEquipment, MissingEquipment] = [
    {
      id: randomUUID(),
      slot: 1,
      name: validated.equipments[0].name,
      notes: validated.equipments[0].notes || "",
      status: "active",
    },
    {
      id: randomUUID(),
      slot: 2,
      name: validated.equipments[1].name,
      notes: validated.equipments[1].notes || "",
      status: "active",
    },
    {
      id: randomUUID(),
      slot: 3,
      name: validated.equipments[2].name,
      notes: validated.equipments[2].notes || "",
      status: "active",
    },
  ];

  const [inserted] = await db
    .insert(missingHabitants)
    .values({
      campaignId: targetCampaignId || null,
      ownerId: userId,
      name: validated.name,
      status: "active",
      lines,
      equipments,
    })
    .returning();

  return {
    id: inserted.id,
    campaignId: inserted.campaignId ?? null,
    ownerId: inserted.ownerId,
    name: inserted.name,
    status: inserted.status as "active" | "missing",
    lines: inserted.lines as HabitantLine[],
    equipments: inserted.equipments as [MissingEquipment, MissingEquipment, MissingEquipment],
    createdAt: inserted.createdAt.toISOString(),
    updatedAt: inserted.updatedAt.toISOString(),
  };
}

// =============================================================================
// 3.1. Listar Habitantes do Usuário Autenticado
// =============================================================================

export async function getUserHabitants(userId: string): Promise<MissingHabitant[]> {
  const records = await db
    .select()
    .from(missingHabitants)
    .where(eq(missingHabitants.ownerId, userId))
    .orderBy(desc(missingHabitants.createdAt));

  return records.map((h) => ({
    id: h.id,
    campaignId: h.campaignId,
    ownerId: h.ownerId,
    name: h.name,
    status: h.status as "active" | "missing",
    lines: h.lines as HabitantLine[],
    equipments: h.equipments as [MissingEquipment, MissingEquipment, MissingEquipment],
    createdAt: h.createdAt.toISOString(),
    updatedAt: h.updatedAt.toISOString(),
  }));
}

// =============================================================================
// 4. Listar Habitantes da Campanha
// =============================================================================

export async function getHabitants(campaignId: string): Promise<MissingHabitant[]> {
  const records = await db
    .select()
    .from(missingHabitants)
    .where(eq(missingHabitants.campaignId, campaignId))
    .orderBy(asc(missingHabitants.createdAt));

  return records.map((h) => ({
    id: h.id,
    campaignId: h.campaignId,
    ownerId: h.ownerId,
    name: h.name,
    status: h.status as "active" | "missing",
    lines: h.lines as HabitantLine[],
    equipments: h.equipments as [MissingEquipment, MissingEquipment, MissingEquipment],
    createdAt: h.createdAt.toISOString(),
    updatedAt: h.updatedAt.toISOString(),
  }));
}

// =============================================================================
// 5. Obter Habitante por ID
// =============================================================================

export async function getHabitantById(habitantId: string): Promise<MissingHabitant | null> {
  const [record] = await db
    .select()
    .from(missingHabitants)
    .where(eq(missingHabitants.id, habitantId))
    .limit(1);

  if (!record) {
    return null;
  }

  return {
    id: record.id,
    campaignId: record.campaignId,
    ownerId: record.ownerId,
    name: record.name,
    status: record.status as "active" | "missing",
    lines: record.lines as HabitantLine[],
    equipments: record.equipments as [MissingEquipment, MissingEquipment, MissingEquipment],
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

// =============================================================================
// 6. Atualizar Habitante (PATCH) com Imutabilidade de Rasuras
// =============================================================================

export async function updateHabitant(
  campaignId: string | null,
  habitantId: string,
  userId: string,
  data: UpdateHabitantInput,
): Promise<MissingHabitant> {
  const validated = updateHabitantSchema.parse(data);

  const habitant = await getHabitantById(habitantId);
  if (!habitant || (campaignId && habitant.campaignId !== campaignId)) {
    throw new Error("Habitante não encontrado");
  }

  if (campaignId) {
    const { campaign, role } = await getCampaignAndRole(campaignId, userId);
    if (!campaign || !role) {
      throw new Error("Acesso não autorizado");
    }

    if (habitant.ownerId !== userId && role !== "voice") {
      throw new Error("Acesso não autorizado para editar este habitante");
    }
  } else {
    if (habitant.ownerId !== userId) {
      throw new Error("Acesso não autorizado para editar este habitante");
    }
  }

  let updatedLines = [...habitant.lines];

  if (validated.lines) {
    const existingLinesMap = new Map(habitant.lines.map((l) => [l.id, l]));

    // Validação estrita: rasuras são irreversíveis
    for (const line of validated.lines) {
      const existing = existingLinesMap.get(line.id);
      if (existing && existing.isErased && !line.isErased) {
        throw new Error("Não é permitido desrasurar uma linha rasurada");
      }
    }

    updatedLines = validated.lines.map((incoming) => {
      const existing = existingLinesMap.get(incoming.id);
      if (existing && existing.isErased) {
        return {
          ...existing,
          isErased: true,
        };
      }
      return incoming;
    });
  }

  if (validated.addLine) {
    if (updatedLines.length >= 30) {
      throw new Error("O Registro de Habitante não pode exceder o limite da folha A4 (máximo 30 linhas)");
    }
    updatedLines.push({
      id: randomUUID(),
      index: updatedLines.length + 1,
      text: validated.addLine,
      isErased: false,
    });
  }

  let updatedEquipments = validated.equipments || [...habitant.equipments];
  if (validated.equipment) {
    const eq = validated.equipment;
    updatedEquipments = updatedEquipments.map((e) =>
      e.slot === eq.slot
        ? {
            ...e,
            name: eq.name,
            notes: eq.notes !== undefined ? eq.notes : e.notes,
            status: eq.status,
            lostReason: eq.lostReason !== undefined ? eq.lostReason : e.lostReason,
          }
        : e,
    ) as [MissingEquipment, MissingEquipment, MissingEquipment];
  }

  const isMissing = checkHabitantDisappearance(updatedLines);
  const status = isMissing ? "missing" : (validated.status || habitant.status);

  const updatedName = validated.name || habitant.name;

  const [updated] = await db
    .update(missingHabitants)
    .set({
      name: updatedName,
      status,
      lines: updatedLines,
      equipments: updatedEquipments,
      updatedAt: new Date(),
    })
    .where(eq(missingHabitants.id, habitantId))
    .returning();

  return {
    id: updated.id,
    campaignId: updated.campaignId,
    ownerId: updated.ownerId,
    name: updated.name,
    status: updated.status as "active" | "missing",
    lines: updated.lines as HabitantLine[],
    equipments: updated.equipments as [MissingEquipment, MissingEquipment, MissingEquipment],
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
}

// =============================================================================
// 7. Rasurar Linha do Registro (Irreversível + Checagem de Desaparecimento)
// =============================================================================

export async function eraseHabitantLine(
  campaignId: string | null,
  habitantId: string,
  userId: string,
  lineId: string,
  reason?: string,
): Promise<MissingHabitant> {
  const habitant = await getHabitantById(habitantId);
  if (!habitant || (campaignId && habitant.campaignId !== campaignId)) {
    throw new Error("Habitante não encontrado");
  }

  let role: Role = "writer";
  if (campaignId) {
    const { campaign, role: userRole } = await getCampaignAndRole(campaignId, userId);
    if (!campaign || !userRole) {
      throw new Error("Acesso não autorizado");
    }
    role = userRole;

    if (habitant.ownerId !== userId && role !== "voice") {
      throw new Error("Acesso não autorizado para rasurar este habitante");
    }
  } else {
    if (habitant.ownerId !== userId) {
      throw new Error("Acesso não autorizado para rasurar este habitante");
    }
  }

  const lineIndex = habitant.lines.findIndex((l) => l.id === lineId);
  if (lineIndex === -1) {
    throw new Error("Linha não encontrada");
  }

  const targetLine = habitant.lines[lineIndex];
  if (targetLine.isErased) {
    throw new Error("Esta linha já foi rasurada e não pode ser alterada");
  }

  const updatedLines = habitant.lines.map((line, idx) => {
    if (idx === lineIndex) {
      return {
        ...line,
        isErased: true,
        erasedAt: new Date().toISOString(),
        erasedReason: reason || "Rasura em registro",
      };
    }
    return line;
  });

  const isMissing = checkHabitantDisappearance(updatedLines);
  const newStatus = isMissing ? "missing" : habitant.status;

  const [updated] = await db
    .update(missingHabitants)
    .set({
      lines: updatedLines,
      status: newStatus,
      updatedAt: new Date(),
    })
    .where(eq(missingHabitants.id, habitantId))
    .returning();

  // Registro auditável no livro-razão se campaignId existir
  if (campaignId) {
    await recordLedgerEvent({
      campaignId,
      habitantId,
      actorRole: role,
      actorId: userId,
      eventType: "LINE_ERASED",
      payload: {
        lineId,
        lineIndex: targetLine.index,
        lineText: targetLine.text,
        reason: reason || "Rasura em registro",
        erasedAt: new Date().toISOString(),
        habitantStatus: newStatus,
        disappeared: isMissing,
      },
    });
  }

  return {
    id: updated.id,
    campaignId: updated.campaignId,
    ownerId: updated.ownerId,
    name: updated.name,
    status: updated.status as "active" | "missing",
    lines: updated.lines as HabitantLine[],
    equipments: updated.equipments as [MissingEquipment, MissingEquipment, MissingEquipment],
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
}

// =============================================================================
// 7.1. Excluir Habitante
// =============================================================================

export async function deleteHabitant(
  habitantId: string,
  userId: string,
): Promise<void> {
  const habitant = await getHabitantById(habitantId);
  if (!habitant) {
    throw new Error("Habitante não encontrado");
  }

  if (habitant.ownerId !== userId) {
    throw new Error("Acesso não autorizado para excluir este habitante");
  }

  await db.delete(missingHabitants).where(eq(missingHabitants.id, habitantId));
}

// =============================================================================
// 8. Atualizar Ameaças da Cena (Voz Only + Limite <= 3)
// =============================================================================

export async function updateSceneThreats(
  campaignId: string,
  userId: string,
  sceneTitle: string,
  threats: MissingThreat[],
): Promise<MissingScene> {
  const { campaign, role } = await getCampaignAndRole(campaignId, userId);
  if (!campaign) {
    throw new Error("Campanha não encontrada");
  }
  if (role !== "voice") {
    throw new Error("Apenas a Voz pode atualizar ameaças da cena");
  }

  // Validação estrita do perigo total <= 3
  const dangerValidation = validateSceneDanger(threats);
  if (!dangerValidation.valid) {
    throw new Error("A soma dos níveis de perigo das ameaças na cena não pode ultrapassar 3");
  }

  const rawState = await getOrCreateCampaignState(campaignId);

  const updatedScene: MissingScene = {
    id: rawState.activeScene?.id || randomUUID(),
    campaignId,
    title: sceneTitle || rawState.activeScene?.title || "Cena",
    isActive: true,
    threats,
  };

  await db
    .update(missingCampaignStates)
    .set({
      activeScene: updatedScene,
      updatedAt: new Date(),
    })
    .where(eq(missingCampaignStates.campaignId, campaignId));

  await recordLedgerEvent({
    campaignId,
    actorRole: "voice",
    actorId: userId,
    eventType: "THREAT_ADDED",
    payload: {
      sceneTitle: updatedScene.title,
      threatsCount: threats.length,
      totalDanger: dangerValidation.totalDanger,
      threats,
    },
  });

  return updatedScene;
}

// =============================================================================
// 9. Criar Pista (Voz Only)
// =============================================================================

export async function createClue(
  campaignId: string,
  userId: string,
  clueData: CreateClueInput,
): Promise<MissingClue> {
  const validated = createClueSchema.parse(clueData);

  const { campaign, role } = await getCampaignAndRole(campaignId, userId);
  if (!campaign) {
    throw new Error("Campanha não encontrada");
  }
  if (role !== "voice") {
    throw new Error("Apenas a Voz pode criar pistas");
  }

  if (validated.deliveredToHabitantId) {
    const habitant = await getHabitantById(validated.deliveredToHabitantId);
    if (!habitant || habitant.campaignId !== campaignId) {
      throw new Error("Habitante de destino não encontrado");
    }
  }

  const rawState = await getOrCreateCampaignState(campaignId);

  const newClue: MissingClue = {
    id: randomUUID(),
    campaignId,
    title: validated.title,
    description: validated.description,
    isFalseClue: validated.isFalseClue ?? false,
    deliveredToHabitantId: validated.deliveredToHabitantId || null,
    createdAt: new Date().toISOString(),
  };

  const updatedBank = [...(rawState.cluesBank || []), newClue];

  await db
    .update(missingCampaignStates)
    .set({
      cluesBank: updatedBank,
      updatedAt: new Date(),
    })
    .where(eq(missingCampaignStates.campaignId, campaignId));

  await recordLedgerEvent({
    campaignId,
    habitantId: newClue.deliveredToHabitantId || undefined,
    actorRole: "voice",
    actorId: userId,
    eventType: "CLUE_CREATED",
    payload: {
      clueId: newClue.id,
      title: newClue.title,
      deliveredToHabitantId: newClue.deliveredToHabitantId,
    },
  });

  if (newClue.deliveredToHabitantId) {
    await recordLedgerEvent({
      campaignId,
      habitantId: newClue.deliveredToHabitantId,
      actorRole: "voice",
      actorId: userId,
      eventType: "CLUE_DELIVERED",
      payload: {
        clueId: newClue.id,
        targetHabitantId: newClue.deliveredToHabitantId,
      },
    });
  }

  return newClue;
}

// =============================================================================
// 10. Entregar Pista a um Habitante (Voz Only)
// =============================================================================

export async function deliverClue(
  campaignId: string,
  userId: string,
  clueId: string,
  targetHabitantId: string | null,
): Promise<MissingClue> {
  const { campaign, role } = await getCampaignAndRole(campaignId, userId);
  if (!campaign) {
    throw new Error("Campanha não encontrada");
  }
  if (role !== "voice") {
    throw new Error("Apenas a Voz pode entregar pistas");
  }

  if (targetHabitantId) {
    const habitant = await getHabitantById(targetHabitantId);
    if (!habitant || habitant.campaignId !== campaignId) {
      throw new Error("Habitante de destino não encontrado");
    }
  }

  const rawState = await getOrCreateCampaignState(campaignId);
  const clueIndex = rawState.cluesBank.findIndex((c) => c.id === clueId);
  if (clueIndex === -1) {
    throw new Error("Pista não encontrada");
  }

  const targetClue = rawState.cluesBank[clueIndex];
  const updatedClue: MissingClue = {
    ...targetClue,
    deliveredToHabitantId: targetHabitantId,
  };

  const updatedBank = [...rawState.cluesBank];
  updatedBank[clueIndex] = updatedClue;

  await db
    .update(missingCampaignStates)
    .set({
      cluesBank: updatedBank,
      updatedAt: new Date(),
    })
    .where(eq(missingCampaignStates.campaignId, campaignId));

  await recordLedgerEvent({
    campaignId,
    habitantId: targetHabitantId || undefined,
    actorRole: "voice",
    actorId: userId,
    eventType: "CLUE_DELIVERED",
    payload: {
      clueId,
      targetHabitantId,
      deliveredAt: new Date().toISOString(),
    },
  });

  return updatedClue;
}

// =============================================================================
// 11. Adicionar Conexão na Teia de Investigação
// =============================================================================

export async function addInvestigationConnection(
  campaignId: string,
  userId: string,
  connectionData: CreateConnectionInput,
): Promise<InvestigationConnection> {
  const validated = createConnectionSchema.parse(connectionData);

  const { campaign, role } = await getCampaignAndRole(campaignId, userId);
  if (!campaign || !role) {
    throw new Error("Acesso não autorizado");
  }

  if (validated.sourceClueId === validated.targetClueId) {
    throw new Error("Não é possível conectar uma pista a ela mesma");
  }

  const rawState = await getOrCreateCampaignState(campaignId);

  const clueIds = new Set(rawState.cluesBank.map((c) => c.id));
  if (!clueIds.has(validated.sourceClueId) || !clueIds.has(validated.targetClueId)) {
    throw new Error("Uma ou ambas as pistas da conexão não foram encontradas");
  }

  const existingConnections = rawState.investigationWeb?.connections || [];
  const alreadyConnected = existingConnections.some(
    (c) =>
      (c.sourceClueId === validated.sourceClueId && c.targetClueId === validated.targetClueId) ||
      (c.sourceClueId === validated.targetClueId && c.targetClueId === validated.sourceClueId),
  );

  if (alreadyConnected) {
    throw new Error("Já existe uma conexão entre estas pistas");
  }

  const newConnection: InvestigationConnection = {
    id: randomUUID(),
    campaignId,
    sourceClueId: validated.sourceClueId,
    targetClueId: validated.targetClueId,
    type: validated.type,
    explanation: validated.explanation,
    createdAt: new Date().toISOString(),
  };

  const updatedConnections = [...existingConnections, newConnection];

  await db
    .update(missingCampaignStates)
    .set({
      investigationWeb: { connections: updatedConnections },
      updatedAt: new Date(),
    })
    .where(eq(missingCampaignStates.campaignId, campaignId));

  await recordLedgerEvent({
    campaignId,
    actorRole: role,
    actorId: userId,
    eventType: "CONNECTION_MADE",
    payload: {
      connectionId: newConnection.id,
      sourceClueId: newConnection.sourceClueId,
      targetClueId: newConnection.targetClueId,
      type: newConnection.type,
      explanation: newConnection.explanation,
    },
  });

  return newConnection;
}

// =============================================================================
// 12. Declarar Epifania (Estágios 1 e 2 + Bloqueio por Pistas Falsas)
// =============================================================================

export async function declareEpiphany(
  campaignId: string,
  userId: string,
  epiphanyData: DeclareEpiphanyInput,
): Promise<EpiphanyRecord> {
  const validated = declareEpiphanySchema.parse(epiphanyData);

  const { campaign, role } = await getCampaignAndRole(campaignId, userId);
  if (!campaign || !role) {
    throw new Error("Acesso não autorizado");
  }

  const rawState = await getOrCreateCampaignState(campaignId);
  const connections = rawState.investigationWeb?.connections || [];
  const currentStage = (rawState.epiphanyHistory?.length || 0) + 1;

  // Validação das regras de estágio (Estágio 1 = 1 de cada, Estágio 2+ = 2 de cada)
  const validation = canDeclareEpiphany(connections, currentStage);
  if (!validation.canDeclare) {
    throw new Error(
      `Conexões insuficientes na Teia de Investigação para declarar Epifania no estágio ${currentStage}. Necessário ao menos ${validation.requiredPerType} de cada tipo (Causa, Origem, Perspectiva).`,
    );
  }

  // Regra de Pistas Falsas (Manual pág. 21): Se houver pista falsa na teia conectada, epifania é frustrada
  const connectedClueIds = new Set<string>();
  for (const conn of connections) {
    connectedClueIds.add(conn.sourceClueId);
    connectedClueIds.add(conn.targetClueId);
  }

  const hasFalseClue = rawState.cluesBank.some(
    (c) => connectedClueIds.has(c.id) && c.isFalseClue === true,
  );

  if (hasFalseClue) {
    throw new Error("Uma das pistas presentes na teia é falsa! A epifania foi frustrada.");
  }

  const newEpiphany: EpiphanyRecord = {
    id: randomUUID(),
    campaignId,
    stage: currentStage,
    chosenEffect: validated.chosenEffect,
    notes: validated.notes,
    createdAt: new Date().toISOString(),
  };

  const updatedHistory = [...(rawState.epiphanyHistory || []), newEpiphany];

  await db
    .update(missingCampaignStates)
    .set({
      epiphanyHistory: updatedHistory,
      updatedAt: new Date(),
    })
    .where(eq(missingCampaignStates.campaignId, campaignId));

  await recordLedgerEvent({
    campaignId,
    actorRole: role,
    actorId: userId,
    eventType: "EPIPHANY_DECLARED",
    payload: {
      epiphanyId: newEpiphany.id,
      stage: currentStage,
      chosenEffect: newEpiphany.chosenEffect,
      notes: newEpiphany.notes,
    },
  });

  return newEpiphany;
}

// =============================================================================
// 13. Executar Teste (Padrão ou Forçado com Perda de Equipamento)
// =============================================================================

export interface ExecuteRollResult {
  rollType: "standard" | "forced";
  originalResult: TestResult;
  forcedResult?: ForcedTestResult;
  habitant: MissingHabitant;
  erasuresCount: number;
}

export async function executeTestRoll(
  campaignId: string,
  userId: string,
  rollData: TestRollInput,
): Promise<ExecuteRollResult> {
  const validated = testRollSchema.parse(rollData);

  const habitant = await getHabitantById(validated.habitantId);
  if (!habitant || habitant.campaignId !== campaignId) {
    throw new Error("Habitante não encontrado");
  }

  const { campaign, role } = await getCampaignAndRole(campaignId, userId);
  if (!campaign || !role) {
    throw new Error("Acesso não autorizado");
  }

  if (habitant.ownerId !== userId && role !== "voice") {
    throw new Error("Acesso não autorizado para rolar testes com este habitante");
  }

  const rawState = await getOrCreateCampaignState(campaignId);
  const activeThreats = rawState.activeScene?.threats || [];

  // Determina dados base (caso não tenham sido passados diretamente)
  let baseDice = validated.dice;
  if (!baseDice || baseDice.length === 0) {
    baseDice = validated.type === "common" ? [roll1d6()] : roll2d6();
  }

  const originalResult = resolveTest({
    type: validated.type,
    dice: baseDice,
    supportGains: validated.supportGains,
  });

  // Teste padrão (não forçado)
  if (!validated.forced) {
    const erasuresCount =
      originalResult.outcome === "loss" ? calculateErasuresOnLoss(activeThreats) : 0;

    await recordLedgerEvent({
      campaignId,
      habitantId: habitant.id,
      actorRole: role,
      actorId: userId,
      eventType: "TEST_ROLLED",
      payload: {
        type: validated.type,
        dice: originalResult.dice,
        selectedDie: originalResult.selectedDie,
        supportBonus: originalResult.supportBonus,
        effectiveTotal: originalResult.effectiveTotal,
        outcome: originalResult.outcome,
        erasuresCount,
        details: originalResult.details,
      },
    });

    return {
      rollType: "standard",
      originalResult,
      habitant,
      erasuresCount,
    };
  }

  // Teste Forçado arriscando equipamento
  if (!validated.equipmentId) {
    throw new Error("Equipamento é obrigatório para testes forçados");
  }

  const eqIndex = habitant.equipments.findIndex((e) => e.id === validated.equipmentId);
  if (eqIndex === -1) {
    throw new Error("Equipamento não encontrado");
  }

  const targetEquipment = habitant.equipments[eqIndex];
  if (targetEquipment.status === "lost") {
    throw new Error("Não é possível forçar o teste com um equipamento inativo ou perdido.");
  }

  const forcedDie = validated.forcedDie ?? roll1d6();

  const forcedResult = resolveForcedTest({
    originalResult,
    forcedDie,
    equipment: targetEquipment,
  });

  let currentHabitant = habitant;

  // Se o novo resultado foi Perda, o equipamento é marcado como "lost" permanentemente
  if (forcedResult.equipmentLost) {
    const updatedEquipments = [...habitant.equipments] as [
      MissingEquipment,
      MissingEquipment,
      MissingEquipment,
    ];
    updatedEquipments[eqIndex] = {
      ...targetEquipment,
      status: "lost",
      lostReason: forcedResult.details,
    };

    const [updated] = await db
      .update(missingHabitants)
      .set({
        equipments: updatedEquipments,
        updatedAt: new Date(),
      })
      .where(eq(missingHabitants.id, habitant.id))
      .returning();

    currentHabitant = {
      id: updated.id,
      campaignId: updated.campaignId,
      ownerId: updated.ownerId,
      name: updated.name,
      status: updated.status as "active" | "missing",
      lines: updated.lines as HabitantLine[],
      equipments: updated.equipments as [MissingEquipment, MissingEquipment, MissingEquipment],
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };

    await recordLedgerEvent({
      campaignId,
      habitantId: habitant.id,
      actorRole: role,
      actorId: userId,
      eventType: "EQUIPMENT_LOST",
      payload: {
        equipmentId: targetEquipment.id,
        equipmentName: targetEquipment.name,
        slot: targetEquipment.slot,
        reason: forcedResult.details,
      },
    });
  }

  const erasuresCount =
    forcedResult.outcome === "loss" ? calculateErasuresOnLoss(activeThreats) : 0;

  await recordLedgerEvent({
    campaignId,
    habitantId: habitant.id,
    actorRole: role,
    actorId: userId,
    eventType: "TEST_FORCED",
    payload: {
      type: validated.type,
      forcedDie,
      equipmentId: targetEquipment.id,
      equipmentName: targetEquipment.name,
      outcome: forcedResult.outcome,
      equipmentLost: forcedResult.equipmentLost,
      effectiveTotal: forcedResult.effectiveTotal,
      erasuresCount,
      details: forcedResult.details,
    },
  });

  return {
    rollType: "forced",
    originalResult,
    forcedResult,
    habitant: currentHabitant,
    erasuresCount,
  };
}

// =============================================================================
// 14. Livro-Razão (Ledger) de Ações com Sanitização de Segredos
// =============================================================================

export async function getCampaignLedger(
  campaignId: string,
  userId?: string,
) {
  let isVoice = true;

  if (userId) {
    const { role } = await getCampaignAndRole(campaignId, userId);
    isVoice = role === "voice";
  }

  const events = await db
    .select()
    .from(missingActionLedger)
    .where(eq(missingActionLedger.campaignId, campaignId))
    .orderBy(asc(missingActionLedger.createdAt));

  if (isVoice) {
    return events;
  }

  // Sanitiza eventos para Redatores: nenhuma pista falsa deve ser revelada no ledger
  return events.map((event) => {
    const payload = { ...(event.payload as Record<string, unknown>) };
    if ("isFalseClue" in payload) {
      delete payload.isFalseClue;
    }
    return {
      ...event,
      payload,
    };
  });
}

// =============================================================================
// Helper: Tratamento Padronizado de Erros de API
// =============================================================================

export function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    const issues = error.issues ?? [];
    return NextResponse.json(
      {
        success: false,
        error: issues.map((e) => e.message).join("; ") || "Dados inválidos",
      },
      { status: 400 },
    );
  }

  if (error instanceof Error) {
    const msg = error.message;
    if (msg.includes("Não autenticado")) {
      return NextResponse.json({ success: false, error: msg }, { status: 401 });
    }
    if (msg.includes("não encontrado") || msg.includes("não encontrada")) {
      return NextResponse.json({ success: false, error: msg }, { status: 404 });
    }
    if (msg.includes("Acesso não autorizado") || msg.includes("Apenas a Voz pode")) {
      return NextResponse.json({ success: false, error: msg }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }

  return NextResponse.json(
    { success: false, error: "Erro interno do servidor" },
    { status: 500 },
  );
}
