// =============================================================================
// Libmork — API Route: Feed de Convites + Lançamento de Sessão (Issue #63)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { getSessionFeed, launchSession } from "@/lib/server/session-service";
import { launchSessionSchema } from "@/lib/validators/sessions";
import { logger } from "@/lib/logger";

/**
 * GET /api/sessions?page=1
 * Feed público de convites de sessão (propostas com vagas abertas).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }
    const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") ?? 1) || 1);
    const feed = await getSessionFeed(session.user.id, page);
    return NextResponse.json({ success: true, data: feed });
  } catch (error) {
    logger.error({ err: error }, "Erro ao listar feed de sessões");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/sessions
 * Lança uma sessão (somente o mestre da campanha).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = launchSessionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Dados inválidos", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const created = await launchSession(session.user.id, parsed.data);
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Campanha não encontrada") {
      return NextResponse.json({ success: false, error: message }, { status: 404 });
    }
    if (message.includes("Apenas o Mestre")) {
      return NextResponse.json({ success: false, error: message }, { status: 403 });
    }
    if (message.includes("obrigatórios na primeira sessão")) {
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }
    logger.error({ err: error }, "Erro ao lançar sessão");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
