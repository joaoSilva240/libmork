// =============================================================================
// Libmork — API Route: Mensagens do Grupo de Chat (Issue #62)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { getGroupMessages, postChatMessage } from "@/lib/server/chat-service";
import { createChatMessageSchema } from "@/lib/validators/chat";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ groupId: string }> };

/**
 * GET /api/chat/groups/:groupId/messages
 * Lista o histórico de mensagens e enquetes do grupo.
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();

    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { groupId } = await params;
    const messages = await getGroupMessages(groupId, session.user.id);

    return NextResponse.json({
      success: true,
      data: messages,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno do servidor";
    if (message.includes("não é membro") || message.includes("não tem permissão")) {
      return NextResponse.json({ success: false, error: message }, { status: 403 });
    }
    logger.error({ err: error }, "Erro ao obter mensagens do chat");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/chat/groups/:groupId/messages
 * Envia uma mensagem ou cria uma enquete no grupo.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();

    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }

    const { groupId } = await params;
    const body = await request.json();

    const validation = createChatMessageSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Dados inválidos",
          errors: validation.error.issues,
        },
        { status: 400 },
      );
    }

    const created = await postChatMessage(groupId, session.user.id, validation.data);

    return NextResponse.json(
      {
        success: true,
        data: created,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno do servidor";
    if (message.includes("não é membro") || message.includes("não tem permissão") || message.includes("Apenas o Mestre")) {
      return NextResponse.json({ success: false, error: message }, { status: 403 });
    }
    if (
      message === "Conteúdo não encontrado para compartilhar" ||
      message === "Publicação não encontrada" ||
      message === "Usuário não encontrado" ||
      message === "Campanha não encontrada"
    ) {
      return NextResponse.json({ success: false, error: message }, { status: 404 });
    }
    logger.error({ err: error }, "Erro ao enviar mensagem no chat");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
