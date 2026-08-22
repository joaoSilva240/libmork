// =============================================================================
// Libmork — API Route: Junção de Conteúdo da Ficha (RF-018, RF-008)
// =============================================================================
// PATCH (treinada/quantidade/permanente) e DELETE (desvincular) — dono.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { characters } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { contentTypeSchema } from "@/lib/validators/content";
import {
  getJunctionTable,
  getJunctionCharacterColumn,
  buildJunctionPatch,
} from "@/lib/db/content-registry";
import { eq, and } from "drizzle-orm";

type RouteContext = {
  params: Promise<{ id: string; type: string; junctionId: string }>;
};

const patchSchemas: Record<
  "skills" | "spells" | "items" | "conditions",
  z.ZodType<Record<string, unknown>>
> = {
  skills: z.object({
    trained: z.boolean(),
  }),
  spells: z.object({}),
  items: z.object({
    quantity: z.number().int().min(1),
  }),
  conditions: z.object({
    permanent: z.boolean(),
  }),
};

/**
 * PATCH /api/characters/:id/content/:type/:junctionId
 * Atualiza campos da junção (apenas o dono do personagem).
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    const { id, type, junctionId } = await params;
    const parsed = contentTypeSchema.safeParse(type);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Tipo de conteúdo inválido" },
        { status: 400 }
      );
    }

    const [character] = await db
      .select()
      .from(characters)
      .where(and(eq(characters.id, id), eq(characters.ownerId, session.user.id)))
      .limit(1);

    if (!character) {
      return NextResponse.json(
        { success: false, error: "Personagem não encontrado" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validator = patchSchemas[parsed.data];
    const validation = validator.safeParse(body);

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

    const junctionTable = getJunctionTable(parsed.data);

    const [existing] = await db
      .select()
      .from(junctionTable)
      .where(
        and(
          eq(junctionTable.id, junctionId),
          eq(getJunctionCharacterColumn(parsed.data), id)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Vínculo não encontrado" },
        { status: 404 }
      );
    }

    const patch = buildJunctionPatch(parsed.data, validation.data as Record<string, unknown>);

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ success: true, data: existing });
    }

    const [updated] = await db
      .update(junctionTable)
      .set(patch as never)
      .where(eq(junctionTable.id, junctionId))
      .returning();

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("Erro ao atualizar vínculo de conteúdo:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/characters/:id/content/:type/:junctionId
 * Desvincula conteúdo da ficha (apenas o dono do personagem).
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    const { id, type, junctionId } = await params;
    const parsed = contentTypeSchema.safeParse(type);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Tipo de conteúdo inválido" },
        { status: 400 }
      );
    }

    const [character] = await db
      .select()
      .from(characters)
      .where(and(eq(characters.id, id), eq(characters.ownerId, session.user.id)))
      .limit(1);

    if (!character) {
      return NextResponse.json(
        { success: false, error: "Personagem não encontrado" },
        { status: 404 }
      );
    }

    const junctionTable = getJunctionTable(parsed.data);

    const [existing] = await db
      .select()
      .from(junctionTable)
      .where(
        and(
          eq(junctionTable.id, junctionId),
          eq(getJunctionCharacterColumn(parsed.data), id)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Vínculo não encontrado" },
        { status: 404 }
      );
    }

    await db.delete(junctionTable).where(eq(junctionTable.id, junctionId));

    return NextResponse.json({
      success: true,
      message: "Conteúdo desvinculado com sucesso",
    });
  } catch (error) {
    console.error("Erro ao desvincular conteúdo:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
