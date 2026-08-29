// =============================================================================
// Libmork — API Route: Upload de Imagem do Personagem (RF-007, RF-063)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { characters } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { saveImage } from "@/lib/utils/uploads";
import { eq, and } from "drizzle-orm";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/characters/:id/image
 * Envia uma imagem para o personagem (apenas o dono).
 * Corpo: multipart/form-data com campo "image".
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

    const formData = await request.formData();
    const file = formData.get("image");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "Arquivo de imagem não enviado (campo 'image')" },
        { status: 400 }
      );
    }

    let filename: string;
    try {
      filename = await saveImage(file, "characters");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao salvar imagem";
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }

    const imageUrl = `/api/uploads/characters/${filename}`;

    const [updatedCharacter] = await db
      .update(characters)
      .set({ imageUrl, updatedAt: new Date() })
      .where(eq(characters.id, id))
      .returning();

    return NextResponse.json({
      success: true,
      data: updatedCharacter,
    });
  } catch (error) {
    logger.error({ err: error }, 'Erro ao enviar imagem');
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}