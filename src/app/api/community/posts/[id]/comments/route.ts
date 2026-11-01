import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { communityComments, communityPosts, users } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";

const commentSchema = z.object({
  content: z.string().trim().min(1, "O comentário não pode ser vazio"),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params;

    // Verifica se o post existe
    const [post] = await db
      .select()
      .from(communityPosts)
      .where(eq(communityPosts.id, postId))
      .limit(1);

    if (!post) {
      return NextResponse.json({ error: "Post não encontrado" }, { status: 404 });
    }

    const comments = await db
      .select({
        id: communityComments.id,
        postId: communityComments.postId,
        content: communityComments.content,
        commentType: communityComments.commentType,
        attachmentContentType: communityComments.attachmentContentType,
        attachmentTitle: communityComments.attachmentTitle,
        attachmentPayload: communityComments.attachmentPayload,
        createdAt: communityComments.createdAt,
        updatedAt: communityComments.updatedAt,
        author: {
          id: users.id,
          displayName: users.displayName,
        },
      })
      .from(communityComments)
      .innerJoin(users, eq(users.id, communityComments.authorId))
      .where(eq(communityComments.postId, postId))
      .orderBy(asc(communityComments.createdAt));

    return NextResponse.json({
      success: true,
      data: comments,
    });
  } catch (error) {
    console.error("Erro ao buscar comentários do post:", error);
    return NextResponse.json(
      { error: "Erro ao buscar comentários. Verifique se as tabelas da comunidade foram criadas no banco de dados." },
      { status: 500 }
    );
  }
}

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

    // Verifica se o post existe
    const [post] = await db
      .select()
      .from(communityPosts)
      .where(eq(communityPosts.id, postId))
      .limit(1);

    if (!post) {
      return NextResponse.json({ error: "Post não encontrado" }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    }

    const validation = commentSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: validation.error.issues },
        { status: 400 }
      );
    }

    const [newComment] = await db
      .insert(communityComments)
      .values({
        postId,
        authorId: session.user.id,
        content: validation.data.content,
      })
      .returning();

    return NextResponse.json(
      {
        ...newComment,
        author: {
          id: session.user.id,
          displayName: session.user.displayName,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro ao adicionar comentário:", error);
    return NextResponse.json(
      { error: "Erro ao adicionar comentário. Verifique se as tabelas da comunidade foram criadas no banco de dados." },
      { status: 500 }
    );
  }
}
