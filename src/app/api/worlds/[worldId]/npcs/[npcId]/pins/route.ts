// =============================================================================
// Libmork — API Route: Pins de NPC (RF-065, D-38)
// =============================================================================
// Atalhos rápidos (magias, habilidades, ataques) na ficha simplificada do NPC.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { npcs, worlds, campaigns, npcPins, skills, spells } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { createNpcPinSchema } from "@/lib/validators/npcPin";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ worldId: string; npcId: string }> };

async function isWorldMaster(worldId: string, userId: string): Promise<boolean> {
  const [world] = await db
    .select()
    .from(worlds)
    .where(eq(worlds.id, worldId))
    .limit(1);

  if (!world || !world.campaignId) return false;

  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, world.campaignId))
    .limit(1);

  return !!campaign && campaign.masterId === userId;
}

/**
 * GET /api/worlds/:worldId/npcs/:npcId/pins
 * Lista os pins do NPC.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    const { worldId, npcId } = await params;

    const isMaster = await isWorldMaster(worldId, session.user.id);

    if (!isMaster) {
      return NextResponse.json(
        { success: false, error: "Sem permissão para acessar os pins deste NPC" },
        { status: 403 }
      );
    }

    const [npc] = await db.select().from(npcs).where(eq(npcs.id, npcId)).limit(1);

    if (!npc || npc.worldId !== worldId) {
      return NextResponse.json(
        { success: false, error: "NPC não encontrado" },
        { status: 404 }
      );
    }

    const pins = await db
      .select()
      .from(npcPins)
      .where(eq(npcPins.npcId, npcId))
      .orderBy(npcPins.createdAt);

    return NextResponse.json({
      success: true,
      data: pins,
    });
  } catch (error) {
    logger.error({ err: error }, 'Erro ao listar pins');
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/worlds/:worldId/npcs/:npcId/pins
 * Cria um pin (apenas o mestre da campanha).
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    const { worldId, npcId } = await params;

    const isMaster = await isWorldMaster(worldId, session.user.id);

    if (!isMaster) {
      return NextResponse.json(
        { success: false, error: "Apenas o mestre da campanha pode gerenciar pins" },
        { status: 403 }
      );
    }

    const [npc] = await db.select().from(npcs).where(eq(npcs.id, npcId)).limit(1);

    if (!npc || npc.worldId !== worldId) {
      return NextResponse.json(
        { success: false, error: "NPC não encontrado" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = createNpcPinSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Dados inválidos",
          errors: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const { pinType, contentId, label, rollExpression, manaCost, circle } =
      validation.data;

    // Se houver contentId, busca nome/custo/círculo da fonte
    let finalLabel = label;
    let finalManaCost = manaCost ?? null;
    let finalCircle = circle ?? null;
    let finalRollExpression = rollExpression ?? null;

    if (contentId) {
      if (pinType === "spell") {
        const [spell] = await db
          .select()
          .from(spells)
          .where(eq(spells.id, contentId))
          .limit(1);

        if (!spell) {
          return NextResponse.json(
            { success: false, error: "Magia não encontrada" },
            { status: 404 }
          );
        }

        finalLabel = spell.name;
        finalManaCost = spell.manaCost;
        finalCircle = spell.circle;
      } else if (pinType === "skill") {
        const [skill] = await db
          .select()
          .from(skills)
          .where(eq(skills.id, contentId))
          .limit(1);

        if (!skill) {
          return NextResponse.json(
            { success: false, error: "Perícia não encontrada" },
            { status: 404 }
          );
        }

        finalLabel = skill.name;
        finalRollExpression = skill.rollExpression ?? null;
      } else {
        return NextResponse.json(
          { success: false, error: "Ataques não usam contentId" },
          { status: 400 }
        );
      }
    }

    const [newPin] = await db
      .insert(npcPins)
      .values({
        npcId,
        pinType,
        contentId: contentId ?? null,
        label: finalLabel,
        rollExpression: finalRollExpression,
        manaCost: finalManaCost,
        circle: finalCircle,
      })
      .returning();

    return NextResponse.json(
      {
        success: true,
        data: newPin,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error({ err: error }, 'Erro ao criar pin');
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}