import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { communityComments, communityPosts, items, npcs, rpgClasses, spells, worlds } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { isModified, sanitizePayload } from "../../../clone-utils";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { id: postId } = await params;

    // Busca o post
    const [post] = await db
      .select()
      .from(communityPosts)
      .where(eq(communityPosts.id, postId))
      .limit(1);

    if (!post) {
      return NextResponse.json({ error: "Post não encontrado" }, { status: 404 });
    }

    const { contentType, payload: originalRawPayload } = post;

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

    const originalSanitized = sanitizePayload(contentType, originalRawPayload);

    let hasModifications = false;
    let finalPayload = originalRawPayload as Record<string, unknown>;

    if (body && body.modifiedPayload && typeof body.modifiedPayload === "object") {
      const sanitizedCandidate = sanitizePayload(contentType, body.modifiedPayload);
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

    let attachedComment: unknown = null;

    if (hasModifications) {
      const authorName = (session.user as any).displayName || "Mestre";
      const attachmentTitle =
        (finalPayload as any).name ||
        (finalPayload as any).title ||
        post.title;

      const [newComment] = await db
        .insert(communityComments)
        .values({
          postId: post.id,
          authorId: session.user.id,
          content: `Versão adaptada importada por ${authorName}`,
          commentType: "attachment",
          attachmentContentType: post.contentType,
          attachmentTitle: String(attachmentTitle),
          attachmentPayload: finalPayload,
        })
        .returning();

      attachedComment = newComment;
    }

    // Incrementa o contador de clones
    await db
      .update(communityPosts)
      .set({ clonesCount: post.clonesCount + 1 })
      .where(eq(communityPosts.id, postId));

    return NextResponse.json({
      success: true,
      message: hasModifications
        ? "Conteúdo adaptado importado com sucesso e anexado aos comentários"
        : "Conteúdo importado com sucesso",
      newEntityId,
      comment: attachedComment,
    });
  } catch (error) {
    console.error("Erro ao clonar conteúdo:", error);
    return NextResponse.json(
      { error: "Erro ao importar conteúdo. Verifique se as tabelas da comunidade foram criadas no banco de dados." },
      { status: 500 }
    );
  }
}
