// =============================================================================
// Libmork — API Route: Classes (RF-033, D-21)
// =============================================================================
// GET: qualquer usuário autenticado. POST/PATCH/DELETE: apenas mestres.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rpgClasses } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { createClassSchema, updateClassSchema } from "@/lib/validators/class";
import { eq } from "drizzle-orm";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/classes
 * Lista todas as classes.
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

    const classes = await db.select().from(rpgClasses).orderBy(rpgClasses.name);

    return NextResponse.json({
      success: true,
      data: classes,
    });
  } catch (error) {
    console.error("Erro ao listar classes:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/classes
 * Cria uma classe (apenas mestres).
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
        { success: false, error: "Apenas mestres podem gerenciar classes" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = createClassSchema.safeParse(body);

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

    const { name, description, initialItems, proficiencies } = validation.data;

    const [newClass] = await db
      .insert(rpgClasses)
      .values({
        name,
        description: description ?? null,
        initialItems,
        proficiencies,
      })
      .returning();

    return NextResponse.json(
      {
        success: true,
        data: newClass,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro ao criar classe:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/classes/:id
 * Atualiza uma classe (apenas mestres).
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

    if (session.user.role !== "master") {
      return NextResponse.json(
        { success: false, error: "Apenas mestres podem gerenciar classes" },
        { status: 403 }
      );
    }

    const { id } = await params;

    const [existing] = await db
      .select()
      .from(rpgClasses)
      .where(eq(rpgClasses.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Classe não encontrada" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = updateClassSchema.safeParse(body);

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

    const [updated] = await db
      .update(rpgClasses)
      .set(validation.data)
      .where(eq(rpgClasses.id, id))
      .returning();

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("Erro ao atualizar classe:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/classes/:id
 * Remove uma classe (apenas mestres).
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

    if (session.user.role !== "master") {
      return NextResponse.json(
        { success: false, error: "Apenas mestres podem gerenciar classes" },
        { status: 403 }
      );
    }

    const { id } = await params;

    const [existing] = await db
      .select()
      .from(rpgClasses)
      .where(eq(rpgClasses.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Classe não encontrada" },
        { status: 404 }
      );
    }

    await db.delete(rpgClasses).where(eq(rpgClasses.id, id));

    return NextResponse.json({
      success: true,
      message: "Classe excluída com sucesso",
    });
  } catch (error) {
    console.error("Erro ao excluir classe:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
