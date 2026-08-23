// =============================================================================
// Libmork — API Route: Upload de Imagem do NPC (RF-014, RF-063)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { npcs } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { canManageNpc } from "@/lib/auth/campaign-access";
import { saveImage } from "@/lib/utils/uploads";
import { eq } from "drizzle-orm";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/npcs/:id/image
 * Envia uma imagem para o NPC (dono ou mestre da campanha).
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

    const allowed = await canManageNpc(id, session.user.id);

    if (!allowed) {
      return NextResponse.json(
        { success: false, error: "Sem permissão para alterar a imagem deste NPC" },
        { status: 403 }
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
      filename = await saveImage(file, "npcs");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao salvar imagem";
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }

    const imageUrl = `/api/uploads/npcs/${filename}`;

    const [updated] = await db
      .update(npcs)
      .set({ imageUrl, updatedAt: new Date() })
      .where(eq(npcs.id, id))
      .returning();

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("Erro ao enviar imagem do NPC:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
