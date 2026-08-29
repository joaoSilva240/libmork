// =============================================================================
// Libmork — API Route: NPCs da Biblioteca (ficha completa estilo jogador)
// =============================================================================
// GET: qualquer usuário autenticado. POST: apenas mestres (ownerId = criador).
// NPCs de biblioteca possuem world_id NULL.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { npcs } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { createNpcSchema } from "@/lib/validators/npc";
import { isNull } from "drizzle-orm";
import { logger } from "@/lib/logger";

/**
 * GET /api/npcs
 * Lista os NPCs da biblioteca (world_id NULL).
 */
export async function GET() {
  try {
    const session = await requireAuth();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    const result = await db
      .select()
      .from(npcs)
      .where(isNull(npcs.worldId))
      .orderBy(npcs.name);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error({ err: error }, 'Erro ao listar NPCs da biblioteca');
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/npcs
 * Cria um NPC de biblioteca (apenas mestres).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    if (session.user.role !== "master") {
      return NextResponse.json(
        { success: false, error: "Apenas mestres podem criar NPCs na biblioteca" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = createNpcSchema.safeParse(body);

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

    const [newNpc] = await db
      .insert(npcs)
      .values({
        ...validation.data,
        worldId: null,
        ownerId: session.user.id,
        imageUrl: validation.data.imageUrl ?? null,
        classId: validation.data.classId ?? null,
      })
      .returning();

    return NextResponse.json(
      {
        success: true,
        data: newNpc,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error({ err: error }, 'Erro ao criar NPC de biblioteca');
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
