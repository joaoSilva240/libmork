// =============================================================================
// Libmork — API Route: Duplicar NPC da Biblioteca
// =============================================================================
// Cria uma cópia idêntica do NPC para compor variações de inimigos.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { npcs } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { canManageNpc } from "@/lib/auth/campaign-access";
import { eq } from "drizzle-orm";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/npcs/:id/duplicate
 * Duplica um NPC (dono ou mestre da campanha do mundo).
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

    const { id } = await params;

    const allowed = await canManageNpc(id, session.user.id);

    if (!allowed) {
      return NextResponse.json(
        { success: false, error: "Sem permissão para duplicar este NPC" },
        { status: 403 }
      );
    }

    const [existing] = await db.select().from(npcs).where(eq(npcs.id, id)).limit(1);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "NPC não encontrado" },
        { status: 404 }
      );
    }

    const [duplicate] = await db
      .insert(npcs)
      .values({
        name: `${existing.name} (cópia)`,
        npcType: existing.npcType,
        worldId: existing.worldId,
        ownerId: session.user.id,
        classId: existing.classId,
        hitPoints: existing.hitPoints,
        hitPointsMax: existing.hitPointsMax,
        manaPoints: existing.manaPoints,
        manaPointsMax: existing.manaPointsMax,
        attributes: existing.attributes,
        level: existing.level,
        xp: existing.xp,
        block: existing.block,
        imageUrl: existing.imageUrl,
        xpReward: existing.xpReward,
      })
      .returning();

    return NextResponse.json(
      {
        success: true,
        data: duplicate,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro ao duplicar NPC:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
