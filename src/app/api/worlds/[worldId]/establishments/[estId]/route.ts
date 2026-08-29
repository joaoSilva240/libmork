import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { establishments } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { eq, and } from "drizzle-orm";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ worldId: string; estId: string }> };

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { worldId, estId } = await params;
    await db
      .delete(establishments)
      .where(and(eq(establishments.id, estId), eq(establishments.worldId, worldId)));

    return NextResponse.json({ success: true, message: "Estabelecimento excluído com sucesso" });
  } catch (error) {
    logger.error({ err: error }, 'Erro ao excluir estabelecimento');
    return NextResponse.json({ success: false, error: "Erro interno do servidor" }, { status: 500 });
  }
}