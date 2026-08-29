// =============================================================================
// Libmork — API Route: Estabelecimentos de um Mundo
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { establishments, worlds } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ worldId: string }> };

const createEstablishmentSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.string().min(1).max(50).default("general"),
  description: z.string().max(2000).optional().nullable(),
});

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { worldId } = await params;
    const data = await db
      .select()
      .from(establishments)
      .where(eq(establishments.worldId, worldId))
      .orderBy(desc(establishments.createdAt));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    logger.error({ err: error }, 'Erro ao listar estabelecimentos');
    return NextResponse.json({ success: false, error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
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

    const body = await request.json();
    const validation = createEstablishmentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: "Dados inválidos", errors: validation.error.issues },
        { status: 400 }
      );
    }

    const [newEst] = await db
      .insert(establishments)
      .values({
        worldId,
        name: validation.data.name,
        type: validation.data.type,
        description: validation.data.description ?? null,
      })
      .returning();

    return NextResponse.json({ success: true, data: newEst }, { status: 201 });
  } catch (error) {
    logger.error({ err: error }, 'Erro ao criar estabelecimento');
    return NextResponse.json({ success: false, error: "Erro interno do servidor" }, { status: 500 });
  }
}