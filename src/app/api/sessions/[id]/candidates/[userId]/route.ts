// =============================================================================
// Libmork — API Route: Decisão sobre Candidatura (Issue #63)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { decideCandidate } from "@/lib/server/session-service";
import { decideCandidateSchema } from "@/lib/validators/sessions";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string; userId: string }> };

/**
 * PATCH /api/sessions/:id/candidates/:userId
 * Mestre aceita ou rejeita uma candidatura.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }
    const { id, userId } = await params;
    const body = await request.json();
    const parsed = decideCandidateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Dados inválidos", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const candidate = await decideCandidate(id, session.user.id, userId, parsed.data.decision);
    return NextResponse.json({ success: true, data: candidate });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Sessão não encontrada" || message === "Candidatura não encontrada") {
      return NextResponse.json({ success: false, error: message }, { status: 404 });
    }
    if (message.includes("Apenas o Mestre")) {
      return NextResponse.json({ success: false, error: message }, { status: 403 });
    }
    if (message === "Vagas esgotadas") {
      return NextResponse.json({ success: false, error: message }, { status: 409 });
    }
    logger.error({ err: error }, "Erro ao decidir candidatura");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
