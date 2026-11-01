import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { communityComments, communityLikes, communityPostVotes, communityPosts, users } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";

const contentTypes = ["spell", "item", "class", "npc", "world", "campaign"] as const;
const postSchema = z.object({
  title: z.string().trim().min(1).max(150), description: z.string().optional().nullable(),
  contentType: z.enum(contentTypes), contentId: z.string().uuid().optional().nullable(),
  tags: z.array(z.string()).default([]), payload: z.unknown(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
  const params = request.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(params.get("limit") ?? 20) || 20));
  const type = params.get("type");
  const search = params.get("search");
  const sort = params.get("sort") || "top";
  const filters = [type && contentTypes.includes(type as (typeof contentTypes)[number]) ? eq(communityPosts.contentType, type) : undefined,
    search ? or(ilike(communityPosts.title, `%${search}%`), ilike(communityPosts.description, `%${search}%`), sql`${communityPosts.tags}::text ILIKE ${`%${search}%`}`) : undefined].filter(Boolean);
  
  const scoreExpr = sql<number>`COALESCE(SUM(${communityPostVotes.value}), 0)`;
  let orderByClause;
  if (sort === "top") {
    orderByClause = desc(scoreExpr);
  } else {
    orderByClause = desc(communityPosts.createdAt);
  }

  const rows = await db
    .select({
      post: communityPosts,
      author: {
        id: users.id,
        displayName: users.displayName,
        masterName: users.masterName,
        masterAvatar: users.masterAvatar,
      },
      likesCount: sql<number>`count(distinct ${communityLikes.userId})`,
      commentsCount: sql<number>`count(distinct ${communityComments.id})`,
      isLikedByMe: session
        ? sql<boolean>`bool_or(${communityLikes.userId} = ${session.user.id})`
        : sql<boolean>`false`,
      upvotes: sql<number>`COALESCE(SUM(CASE WHEN ${communityPostVotes.value} = 1 THEN 1 ELSE 0 END), 0)`,
      downvotes: sql<number>`COALESCE(SUM(CASE WHEN ${communityPostVotes.value} = -1 THEN 1 ELSE 0 END), 0)`,
      score: scoreExpr,
      userVote: session
        ? sql<number>`MAX(CASE WHEN ${communityPostVotes.userId} = ${session.user.id} THEN ${communityPostVotes.value} ELSE NULL END)`
        : sql<number>`NULL`,
    })
    .from(communityPosts)
    .innerJoin(users, eq(users.id, communityPosts.authorId))
    .leftJoin(communityLikes, eq(communityLikes.postId, communityPosts.id))
    .leftJoin(communityComments, eq(communityComments.postId, communityPosts.id))
    .leftJoin(communityPostVotes, eq(communityPostVotes.postId, communityPosts.id))
    .where(and(...filters))
    .groupBy(communityPosts.id, users.id)
    .orderBy(orderByClause)
    .limit(limit)
    .offset((page - 1) * limit);
  return NextResponse.json({ success: true, data: rows.map(({ post, author, likesCount, commentsCount, isLikedByMe, upvotes, downvotes, score, userVote }) => ({ ...post, author, likesCount: Number(likesCount), commentsCount: Number(commentsCount), isLikedByMe: Boolean(isLikedByMe), upvotes: Number(upvotes), downvotes: Number(downvotes), score: Number(score), userVote: userVote !== null ? Number(userVote) : null })), page, limit });
  } catch (error) {
    console.error("Erro ao buscar posts da comunidade:", error);
    return NextResponse.json({ error: "Erro ao buscar posts. Verifique se as tabelas da comunidade foram criadas no banco de dados." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    const parsed = postSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Dados inválidos", details: parsed.error.issues }, { status: 400 });
    const [post] = await db.insert(communityPosts).values({ ...parsed.data, authorId: session.user.id }).returning();
    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar post na comunidade:", error);
    return NextResponse.json({ error: "Erro ao criar post. Verifique se as tabelas da comunidade foram criadas no banco de dados." }, { status: 500 });
  }
}
