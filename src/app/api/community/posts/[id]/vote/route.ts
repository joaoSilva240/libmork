import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { communityPosts, communityPostVotes } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";

const voteSchema = z.object({
  value: z.union([z.literal(1), z.literal(-1)]),
});

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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    }

    const parsed = voteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Valor de voto inválido. Use 1 ou -1." },
        { status: 400 }
      );
    }

    const voteValue = parsed.data.value;

    const [post] = await db
      .select({ id: communityPosts.id })
      .from(communityPosts)
      .where(eq(communityPosts.id, postId))
      .limit(1);

    if (!post) {
      return NextResponse.json({ error: "Post não encontrado" }, { status: 404 });
    }

    const [existing] = await db
      .select({ value: communityPostVotes.value })
      .from(communityPostVotes)
      .where(
        and(
          eq(communityPostVotes.postId, postId),
          eq(communityPostVotes.userId, session.user.id)
        )
      )
      .limit(1);

    let newUserVote: number | null = null;

    if (existing) {
      if (existing.value === voteValue) {
        // Toggle off
        await db
          .delete(communityPostVotes)
          .where(
            and(
              eq(communityPostVotes.postId, postId),
              eq(communityPostVotes.userId, session.user.id)
            )
          );
        newUserVote = null;
      } else {
        // Switch vote
        await db
          .update(communityPostVotes)
          .set({
            value: voteValue,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(communityPostVotes.postId, postId),
              eq(communityPostVotes.userId, session.user.id)
            )
          );
        newUserVote = voteValue;
      }
    } else {
      // Insert vote
      await db.insert(communityPostVotes).values({
        postId,
        userId: session.user.id,
        value: voteValue,
      });
      newUserVote = voteValue;
    }

    const [aggregate] = await db
      .select({
        upvotes: sql<number>`COALESCE(SUM(CASE WHEN ${communityPostVotes.value} = 1 THEN 1 ELSE 0 END), 0)`,
        downvotes: sql<number>`COALESCE(SUM(CASE WHEN ${communityPostVotes.value} = -1 THEN 1 ELSE 0 END), 0)`,
        score: sql<number>`COALESCE(SUM(${communityPostVotes.value}), 0)`,
      })
      .from(communityPostVotes)
      .where(eq(communityPostVotes.postId, postId));

    return NextResponse.json({
      upvotes: Number(aggregate?.upvotes ?? 0),
      downvotes: Number(aggregate?.downvotes ?? 0),
      score: Number(aggregate?.score ?? 0),
      userVote: newUserVote,
    });
  } catch (error) {
    console.error("Erro ao registrar voto:", error);
    return NextResponse.json(
      { error: "Erro ao registrar voto. Verifique o banco de dados." },
      { status: 500 }
    );
  }
}
