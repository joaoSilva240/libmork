// =============================================================================
// Libmork — API Route: Benefício Específico (RF-033, D-21)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rpgClasses, classLevelBenefits } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { updateClassBenefitSchema } from "@/lib/validators/class";
import { eq, and } from "drizzle-orm";

type RouteContext = { params: Promise<{ id: string; benefitId: string }> };

/**
 * PATCH /api/classes/:id/benefits/:benefitId
 * Atualiza um benefício (apenas mestres).
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

    const { id, benefitId } = await params;

    const [rpgClass] = await db
      .select()
      .from(rpgClasses)
      .where(eq(rpgClasses.id, id))
      .limit(1);

    if (!rpgClass) {
      return NextResponse.json(
        { success: false, error: "Classe não encontrada" },
        { status: 404 }
      );
    }

    const [existing] = await db
      .select()
      .from(classLevelBenefits)
      .where(
        and(
          eq(classLevelBenefits.id, benefitId),
          eq(classLevelBenefits.classId, id)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Benefício não encontrado" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validation = updateClassBenefitSchema.safeParse(body);

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
      .update(classLevelBenefits)
      .set(validation.data)
      .where(eq(classLevelBenefits.id, benefitId))
      .returning();

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("Erro ao atualizar benefício:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/classes/:id/benefits/:benefitId
 * Remove um benefício (apenas mestres).
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

    const { id, benefitId } = await params;

    const [rpgClass] = await db
      .select()
      .from(rpgClasses)
      .where(eq(rpgClasses.id, id))
      .limit(1);

    if (!rpgClass) {
      return NextResponse.json(
        { success: false, error: "Classe não encontrada" },
        { status: 404 }
      );
    }

    const [existing] = await db
      .select()
      .from(classLevelBenefits)
      .where(
        and(
          eq(classLevelBenefits.id, benefitId),
          eq(classLevelBenefits.classId, id)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Benefício não encontrado" },
        { status: 404 }
      );
    }

    await db.delete(classLevelBenefits).where(eq(classLevelBenefits.id, benefitId));

    return NextResponse.json({
      success: true,
      message: "Benefício excluído com sucesso",
    });
  } catch (error) {
    console.error("Erro ao excluir benefício:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
