// =============================================================================
// Libmork — API Route: Permissões/Remoção de Membro do Grupo (Issue #62)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { updateMemberPermissions, removeGroupMember } from "@/lib/server/chat-service";
import { updateMemberPermissionsSchema } from "@/lib/validators/chat";
import { logger } from "@/lib/logger";

type RouteContext = { params: Promise<{ groupId: string; userId: string }> };

/**
 * PATCH /api/chat/groups/:groupId/members/:userId
 * Atualiza as permissões de um membro (somente o Mestre/admin).
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }
    const { groupId, userId } = await params;
    const body = await request.json();
    const parsed = updateMemberPermissionsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Dados inválidos", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const member = await updateMemberPermissions(groupId, session.user.id, userId, parsed.data);
    return NextResponse.json({ success: true, data: member });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Apenas o Mestre") || message.includes("administrador")) {
      return NextResponse.json({ success: false, error: message }, { status: 403 });
    }
    if (message === "Membro não encontrado" || message === "Você não é membro deste grupo") {
      return NextResponse.json({ success: false, error: message }, { status: 404 });
    }
    logger.error({ err: error }, "Erro ao atualizar permissões do membro");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/chat/groups/:groupId/members/:userId
 * Remove um membro do grupo (somente o Mestre/admin; não remove admins).
 */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    }
    const { groupId, userId } = await params;
    await removeGroupMember(groupId, session.user.id, userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Apenas o Mestre") || message.includes("administrador")) {
      return NextResponse.json({ success: false, error: message }, { status: 403 });
    }
    if (message === "Membro não encontrado" || message === "Você não é membro deste grupo") {
      return NextResponse.json({ success: false, error: message }, { status: 404 });
    }
    logger.error({ err: error }, "Erro ao remover membro do grupo");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 },
    );
  }
}
