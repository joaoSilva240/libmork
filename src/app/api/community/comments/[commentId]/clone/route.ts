import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  communityComments,
  communityPosts,
  items,
  npcs,
  rpgClasses,
  spells,
  worlds,
} from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { isModified, sanitizePayload } from "../../../clone-utils";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { commentId } = await params;

    const [comment] = await db
      .select()
      .from(communityComments)
      .where(eq(communityComments.id, commentId))
      .limit(1);

    if (!comment) {
      return NextResponse.json(
        { error: "Comentário não encontrado" },
        { status: 404 }
      );
    }

    if (
      comment.commentType !== "attachment" ||
      !comment.attachmentContentType ||
      !comment.attachmentPayload
    ) {
      return NextResponse.json(
        { error: "Comentário não é uma versão anexada" },
        { status: 400 }
      );
    }

    const contentType = comment.attachmentContentType;

    if (contentType === "campaign") {
      return NextResponse.json(
        { error: "Clonagem de campanhas não é suportada ainda" },
        { status: 400 }
      );
    }

    let body: { modifiedPayload?: unknown } = {};
    try {
      body = await request.json();
    } catch {
      // Body é opcional
    }

    const originalSanitized = sanitizePayload(
      contentType,
      comment.attachmentPayload
    );

    let hasModifications = false;
    let finalPayload = comment.attachmentPayload as Record<string, unknown>;

    if (body && body.modifiedPayload && typeof body.modifiedPayload === "object") {
      const sanitizedCandidate = sanitizePayload(
        contentType,
        body.modifiedPayload
      );
      if (isModified(originalSanitized, sanitizedCandidate)) {
        hasModifications = true;
        finalPayload = sanitizedCandidate;
      }
    }

    let newEntityId: string | undefined;

    switch (contentType) {
      case "spell": {
        const [inserted] = await db
          .insert(spells)
          .values({
            ...(finalPayload as any),
            id: undefined,
            campaignId: null,
            createdAt: undefined,
            updatedAt: undefined,
          })
          .returning();
        newEntityId = inserted.id;
        break;
      }

      case "item": {
        const [inserted] = await db
          .insert(items)
          .values({
            ...(finalPayload as any),
            id: undefined,
            campaignId: null,
            createdAt: undefined,
            updatedAt: undefined,
          })
          .returning();
        newEntityId = inserted.id;
        break;
      }

      case "class": {
        const [inserted] = await db
          .insert(rpgClasses)
          .values({
            ...(finalPayload as any),
            id: undefined,
          })
          .returning();
        newEntityId = inserted.id;
        break;
      }

      case "npc": {
        const [inserted] = await db
          .insert(npcs)
          .values({
            ...(finalPayload as any),
            id: undefined,
            ownerId: session.user.id,
            worldId: null,
            createdAt: undefined,
            updatedAt: undefined,
          })
          .returning();
        newEntityId = inserted.id;
        break;
      }

      case "world": {
        const [inserted] = await db
          .insert(worlds)
          .values({
            ...(finalPayload as any),
            id: undefined,
            campaignId: null,
            createdAt: undefined,
            updatedAt: undefined,
          })
          .returning();
        newEntityId = inserted.id;
        break;
      }

      default:
        return NextResponse.json(
          { error: "Tipo de conteúdo inválido" },
          { status: 400 }
        );
    }

    let newAttachmentComment: unknown = null;

    if (hasModifications) {
      const authorName = (session.user as any).displayName || "Mestre";
      const attachmentTitle =
        (finalPayload as any).name ||
        (finalPayload as any).title ||
        comment.attachmentTitle ||
        "Versão adaptada";

      const [insertedComment] = await db
        .insert(communityComments)
        .values({
          postId: comment.postId,
          authorId: session.user.id,
          content: `Versão adaptada importada por ${authorName}`,
          commentType: "attachment",
          attachmentContentType: contentType,
          attachmentTitle: String(attachmentTitle),
          attachmentPayload: finalPayload,
        })
        .returning();

      newAttachmentComment = insertedComment;
    }

    // Incrementa clonesCount no post pai
    const [parentPost] = await db
      .select({ clonesCount: communityPosts.clonesCount })
      .from(communityPosts)
      .where(eq(communityPosts.id, comment.postId))
      .limit(1);

    if (parentPost) {
      await db
        .update(communityPosts)
        .set({ clonesCount: parentPost.clonesCount + 1 })
        .where(eq(communityPosts.id, comment.postId));
    }

    return NextResponse.json({
      success: true,
      message: hasModifications
        ? "Versão modificada importada com sucesso e anexada aos comentários"
        : "Versão anexada importada com sucesso",
      newEntityId,
      comment: newAttachmentComment,
    });
  } catch (error) {
    console.error("Erro ao clonar anexo:", error);
    return NextResponse.json(
      { error: "Erro ao importar versão anexada" },
      { status: 500 }
    );
  }
}
