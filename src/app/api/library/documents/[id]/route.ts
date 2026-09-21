import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { libraryDocuments } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { updateLibraryDocumentSchema } from "@/lib/validators/library-document";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/library/documents/[id]
 * Atualiza metadados do documento.
 * Protegido por autenticação.
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

    const { id } = await params;

    const body = await request.json();
    const validation = updateLibraryDocumentSchema.safeParse(body);

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

    // Verifica se o documento existe
    const [existingDoc] = await db
      .select()
      .from(libraryDocuments)
      .where(eq(libraryDocuments.id, id))
      .limit(1);

    if (!existingDoc) {
      return NextResponse.json(
        { success: false, error: "Documento não encontrado" },
        { status: 404 }
      );
    }

    const [updatedDoc] = await db
      .update(libraryDocuments)
      .set({
        ...validation.data,
        updatedAt: new Date(),
      })
      .where(eq(libraryDocuments.id, id))
      .returning();

    return NextResponse.json({
      success: true,
      data: updatedDoc,
    });
  } catch (error) {
    logger.error({ err: error }, "Erro ao atualizar documento da biblioteca");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/library/documents/[id]
 * Exclui documento da biblioteca.
 * Protegido por autenticação.
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

    const { id } = await params;

    const [existingDoc] = await db
      .select()
      .from(libraryDocuments)
      .where(eq(libraryDocuments.id, id))
      .limit(1);

    if (!existingDoc) {
      return NextResponse.json(
        { success: false, error: "Documento não encontrado" },
        { status: 404 }
      );
    }

    await db.delete(libraryDocuments).where(eq(libraryDocuments.id, id));

    return NextResponse.json({
      success: true,
      data: { id },
    });
  } catch (error) {
    logger.error({ err: error }, "Erro ao excluir documento da biblioteca");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
