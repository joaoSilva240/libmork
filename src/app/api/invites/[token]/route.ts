// =============================================================================
// Libmork — API Route: Convite Público (RF-015)
// =============================================================================
// GET sem autenticação (mostra a campanha no link).
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getPublicInvite } from "@/lib/server/public-invite";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ token: string }> };

/**
 * GET /api/invites/:token
 * Retorna as informações da campanha do convite (público).
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { token } = await params;
    const result = await getPublicInvite(token);

    if (!result.invite) {
      return NextResponse.json(
        { success: false, error: result.error === "campaign-not-found" ? "Campanha não encontrada" : "Convite inválido ou revogado" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.invite,
    });
  } catch (error) {
    logger.error({ err: error }, 'Erro ao obter convite');
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}