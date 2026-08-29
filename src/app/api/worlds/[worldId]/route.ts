// =============================================================================
// Libmork — API Route: Mundo por ID (GET, PATCH, DELETE)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { worlds, establishments, encounters, npcs } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { createWorldSchema } from "@/lib/validators/campaign";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ worldId: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { worldId } = await params;
    const [world] = await db.select().from(worlds).where(eq(worlds.id, worldId)).limit(1);

    if (!world) {
      return NextResponse.json({ success: false, error: "Mundo não encontrado" }, { status: 404 });
    }

    const worldEstablishments = await db
      .select()
      .from(establishments)
      .where(eq(establishments.worldId, worldId));

    const worldEncounters = await db
      .select()
      .from(encounters)
      .where(eq(encounters.worldId, worldId));

    const worldNpcs = await db
      .select()
      .from(npcs)
      .where(eq(npcs.worldId, worldId));

    return NextResponse.json({
      success: true,
      data: {
        ...world,
        establishments: worldEstablishments,
        encounters: worldEncounters,
        npcs: worldNpcs,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Erro ao buscar mundo');
    return NextResponse.json({ success: false, error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { worldId } = await params;
    const body = await request.json();
    const validation = createWorldSchema.partial().safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: "Dados inválidos", errors: validation.error.issues },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(worlds)
      .set(validation.data)
      .where(eq(worlds.id, worldId))
      .returning();

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    logger.error({ err: error }, 'Erro ao atualizar mundo');
    return NextResponse.json({ success: false, error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { worldId } = await params;
    await db.delete(worlds).where(eq(worlds.id, worldId));

    return NextResponse.json({ success: true, message: "Mundo excluído com sucesso" });
  } catch (error) {
    logger.error({ err: error }, 'Erro ao excluir mundo');
    return NextResponse.json({ success: false, error: "Erro interno do servidor" }, { status: 500 });
  }
}