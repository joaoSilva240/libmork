// =============================================================================
// Libmork — API Route: Aquisição de Personagem via Token (Issue #79)
// =============================================================================
// GET  → preview para jogador autenticado (link kind "acquire")
// POST → duplica a ficha sob o novo dono

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import {
  acquireCharacter,
  getAcquirePreview,
} from "@/lib/server/character-share-service";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ token: string }> };

function mapError(error: unknown) {
  const message = error instanceof Error ? error.message : "Erro interno do servidor";
  if (message === "Link inválido ou revogado" || message === "Personagem não encontrado") {
    return NextResponse.json({ success: false, error: message }, { status: 404 });
  }
  if (message === "Você já possui este personagem") {
    return NextResponse.json({ success: false, error: message }, { status: 409 });
  }
  logger.error({ err: error }, "Erro na aquisição de personagem");
  return NextResponse.json(
    { success: false, error: "Erro interno do servidor" },
    { status: 500 }
  );
}

/**
 * GET /api/characters/import/:token
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    const { token } = await params;
    const preview = await getAcquirePreview(token, session.user.id);
    return NextResponse.json({ success: true, data: preview });
  } catch (error) {
    return mapError(error);
  }
}

/**
 * POST /api/characters/import/:token
 * Cria a cópia independente sob o usuário autenticado.
 */
export async function POST(_request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    const { token } = await params;
    const result = await acquireCharacter(token, session.user.id);
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return mapError(error);
  }
}
