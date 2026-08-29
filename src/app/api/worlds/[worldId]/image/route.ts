// =============================================================================
// Libmork — API Route: Upload de Imagens de Mundo (Capa / Mapa)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { worlds } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { saveImage } from "@/lib/utils/uploads";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ worldId: string }> };

/**
 * POST /api/worlds/:worldId/image
 * Envia uma imagem para o Mundo (capa ou mapa).
 * Corpo: multipart/form-data com campos:
 * - "image" (File)
 * - "type" ("cover" | "map")
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

    const { worldId } = await params;

    const [existingWorld] = await db
      .select()
      .from(worlds)
      .where(eq(worlds.id, worldId))
      .limit(1);

    if (!existingWorld) {
      return NextResponse.json(
        { success: false, error: "Mundo não encontrado" },
        { status: 404 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("image");
    const type = formData.get("type");

    if (type !== "cover" && type !== "map") {
      return NextResponse.json(
        { success: false, error: "Tipo de imagem inválido. Use 'cover' ou 'map'." },
        { status: 400 }
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "Arquivo de imagem não enviado (campo 'image')" },
        { status: 400 }
      );
    }

    let filename: string;
    try {
      filename = await saveImage(file, "worlds");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao salvar imagem";
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }

    const imageUrl = `/api/uploads/worlds/${filename}`;
    const updateData =
      type === "cover"
        ? { coverUrl: imageUrl }
        : { mapUrl: imageUrl };

    const [updatedWorld] = await db
      .update(worlds)
      .set(updateData)
      .where(eq(worlds.id, worldId))
      .returning();

    return NextResponse.json({
      success: true,
      data: {
        coverUrl: updatedWorld.coverUrl,
        mapUrl: updatedWorld.mapUrl,
        type,
      },
    });
  } catch (error) {
    logger.error({ err: error }, 'Erro ao enviar imagem do mundo');
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}