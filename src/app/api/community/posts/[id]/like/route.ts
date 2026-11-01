import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { communityLikes, communityPosts } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";

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

  // Verifica se já curtiu
  const [existing] = await db
    .select()
    .from(communityLikes)
    .where(
      and(
        eq(communityLikes.postId, postId),
        eq(communityLikes.userId, session.user.id)
      )
    )
    .limit(1);

  let isLiked: boolean;

  if (existing) {
    // Remove like
    await db
      .delete(communityLikes)
      .where(
        and(
          eq(communityLikes.postId, postId),
          eq(communityLikes.userId, session.user.id)
        )
      );
    isLiked = false;
  } else {
    // Adiciona like
    await db.insert(communityLikes).values({
      postId,
      userId: session.user.id,
    });
    isLiked = true;
  }

  // Conta likes totais
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(communityLikes)
    .where(eq(communityLikes.postId, postId));

  return NextResponse.json({
    isLiked,
    likesCount: Number(result.count),
  });
  } catch (error) {
    console.error("Erro ao processar like:", error);
    return NextResponse.json({ error: "Erro ao processar like. Verifique se as tabelas da comunidade foram criadas no banco de dados." }, { status: 500 });
  }
}
