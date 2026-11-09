// =============================================================================
// Libmork — API Route: Catálogo de Compartilhamento do Chat (Issue #62)
// =============================================================================

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { getShareCatalog } from "@/lib/server/chat-service";
import { logger } from "@/lib/logger";

/**
 * GET /api/chat/share-catalog
 * Retorna biblioteca global, publicações e campanhas do mestre para o SharePicker.
 */
export async function GET() {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }
    const catalog = await getShareCatalog(session.user.id);
    return NextResponse.json({ success: true, data: catalog });
  } catch (error) {
    logger.error({ err: error }, "Erro ao montar catálogo de compartilhamento");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
