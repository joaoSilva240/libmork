// =============================================================================
// Libmork — API Route: Upload de Imagens de Campanha (Capa / Mapa)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { saveImage } from "@/lib/utils/uploads";
import { logger } from "@/lib/logger";

/**
 * POST /api/campaigns/upload
 * Faz upload de imagem para Campanha (capa ou mapa-múndi).
 * multipart/form-data:
 * - "image": File
 * - "type": "cover" | "map"
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
      filename = await saveImage(file, "campaigns");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao salvar imagem";
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }

    const url = `/api/uploads/campaigns/${filename}`;

    return NextResponse.json({
      success: true,
      data: {
        url,
        type,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Erro ao fazer upload de imagem da campanha");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
