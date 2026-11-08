// =============================================================================
// Libmork — API Route: Detalhe e Gestão de Sessão (Issue #63)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { getSessionDetail, confirmSession, cancelSession } from "@/lib/server/session-service";
import { updateSessionSchema } from "@/lib/validators/sessions";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/sessions/:id
 * Detalhe da sessão para o visualizador (com a própria candidatura, se houver).
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }
    const { id } = await params;
    const detail = await getSessionDetail(id, session.user.id);
    return NextResponse.json({ success: true, data: detail });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Sessão não encontrada") {
      return NextResponse.json({ success: false, error: message }, { status: 404 });
    }
    logger.error({ err: error }, "Erro ao buscar sessão");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/sessions/:id
 * Confirma (action: "confirm") ou cancela (action: "cancel") a sessão — só o mestre.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }
    const { id } = await params;
    const body = await request.json();
    const parsed = updateSessionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Dados inválidos", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    if (parsed.data.action === "confirm") {
      const confirmed = await confirmSession(
        id,
        session.user.id,
        parsed.data.scheduledAt,
        parsed.data.durationMinutes,
      );
      return NextResponse.json({ success: true, data: confirmed });
    }

    await cancelSession(id, session.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Sessão não encontrada") {
      return NextResponse.json({ success: false, error: message }, { status: 404 });
    }
    if (message.includes("Apenas o Mestre")) {
      return NextResponse.json({ success: false, error: message }, { status: 403 });
    }
    if (
      message === "Sessão já confirmada ou cancelada" ||
      message === "Data final fora do período proposto"
    ) {
      return NextResponse.json({ success: false, error: message }, { status: 409 });
    }
    logger.error({ err: error }, "Erro ao atualizar sessão");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
