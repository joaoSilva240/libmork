// =============================================================================
// Libmork — API Route: Mundo por ID (GET, PATCH, DELETE)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { worlds, establishments, encounters, npcs } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { createWorldSchema } from "@/lib/validators/campaign";
import { eq } from "drizzle-orm";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { id } = await params;
    const [world] = await db.select().from(worlds).where(eq(worlds.id, id)).limit(1);

    if (!world) {
      return NextResponse.json({ success: false, error: "Mundo não encontrado" }, { status: 404 });
    }

    const worldEstablishments = await db
      .select()
      .from(establishments)
      .where(eq(establishments.worldId, id));

    const worldEncounters = await db
      .select()
      .from(encounters)
      .where(eq(encounters.worldId, id));

    const worldNpcs = await db
      .select()
      .from(npcs)
      .where(eq(npcs.worldId, id));

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
    console.error("Erro ao buscar mundo:", error);
    return NextResponse.json({ success: false, error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { id } = await params;
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
      .where(eq(worlds.id, id))
      .returning();

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("Erro ao atualizar mundo:", error);
    return NextResponse.json({ success: false, error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { id } = await params;
    await db.delete(worlds).where(eq(worlds.id, id));

    return NextResponse.json({ success: true, message: "Mundo excluído com sucesso" });
  } catch (error) {
    console.error("Erro ao excluir mundo:", error);
    return NextResponse.json({ success: false, error: "Erro interno do servidor" }, { status: 500 });
  }
}
