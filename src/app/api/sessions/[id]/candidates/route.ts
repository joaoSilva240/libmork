// =============================================================================
// Libmork — API Route: Candidaturas de uma Sessão (Issue #63)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { listSessionCandidates, applyToSession } from "@/lib/server/session-service";
import { applySessionSchema } from "@/lib/validators/sessions";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/sessions/:id/candidates
 * Panorama de candidaturas (somente o mestre da sessão).
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }
    const { id } = await params;
    const candidates = await listSessionCandidates(id, session.user.id);
    return NextResponse.json({ success: true, data: candidates });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Sessão não encontrada") {
      return NextResponse.json({ success: false, error: message }, { status: 404 });
    }
    if (message.includes("Apenas o Mestre")) {
      return NextResponse.json({ success: false, error: message }, { status: 403 });
    }
    logger.error({ err: error }, "Erro ao listar candidaturas");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/sessions/:id/candidates
 * Jogador se candidata à sessão (upsert por sessão+usuário).
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }
    const { id } = await params;
    const body = await request.json();
    const parsed = applySessionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Dados inválidos", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const candidate = await applyToSession(id, session.user.id, parsed.data);
    return NextResponse.json({ success: true, data: candidate }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Sessão não encontrada") {
      return NextResponse.json({ success: false, error: message }, { status: 404 });
    }
    if (
      message === "Esta sessão não está mais aberta a candidaturas" ||
      message === "Vagas esgotadas"
    ) {
      return NextResponse.json({ success: false, error: message }, { status: 409 });
    }
    if (
      message === "O mestre não pode candidatar-se à própria sessão" ||
      message === "Selecione ao menos um dia disponível"
    ) {
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }
    logger.error({ err: error }, "Erro ao candidatar-se à sessão");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
