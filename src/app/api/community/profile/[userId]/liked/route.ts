import { NextRequest, NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { communityComments, communityLikes, communityPostVotes, communityPosts, users } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";

const userLikes = alias(communityLikes, "user_likes");
const allLikes = alias(communityLikes, "all_likes");

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await requireAuth();
    const { userId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 20) || 20));

    const rows = await db
      .select({
        post: communityPosts,
        author: {
          id: users.id,
          displayName: users.displayName,
          masterName: users.masterName,
          masterAvatar: users.masterAvatar,
        },
        likedAt: userLikes.createdAt,
        likesCount: sql<number>`count(distinct ${allLikes.userId})`,
        commentsCount: sql<number>`count(distinct ${communityComments.id})`,
        isLikedByMe: session
          ? sql<boolean>`bool_or(${allLikes.userId} = ${session.user.id})`
          : sql<boolean>`false`,
        upvotes: sql<number>`COALESCE(SUM(CASE WHEN ${communityPostVotes.value} = 1 THEN 1 ELSE 0 END), 0)`,
        downvotes: sql<number>`COALESCE(SUM(CASE WHEN ${communityPostVotes.value} = -1 THEN 1 ELSE 0 END), 0)`,
        score: sql<number>`COALESCE(SUM(${communityPostVotes.value}), 0)`,
        userVote: session ? sql<number>`MAX(CASE WHEN ${communityPostVotes.userId} = ${session.user.id} THEN ${communityPostVotes.value} ELSE NULL END)` : sql<number>`NULL`,
      })
      .from(userLikes)
      .innerJoin(communityPosts, eq(communityPosts.id, userLikes.postId))
      .innerJoin(users, eq(users.id, communityPosts.authorId))
      .leftJoin(allLikes, eq(allLikes.postId, communityPosts.id))
      .leftJoin(communityComments, eq(communityComments.postId, communityPosts.id))
      .leftJoin(communityPostVotes, eq(communityPostVotes.postId, communityPosts.id))
      .where(eq(userLikes.userId, userId))
      .groupBy(communityPosts.id, users.id, userLikes.createdAt)
      .orderBy(desc(userLikes.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    return NextResponse.json({
      success: true,
      data: rows.map(
        ({
          post,
          author,
          likesCount,
          commentsCount,
          isLikedByMe,
          likedAt,
          upvotes,
          downvotes,
          score,
          userVote,
        }) => ({
          ...post,
          author,
          likedAt,
          likesCount: Number(likesCount),
          commentsCount: Number(commentsCount),
          isLikedByMe: Boolean(isLikedByMe),
          upvotes: Number(upvotes),
          downvotes: Number(downvotes),
          score: Number(score),
          userVote: userVote !== null ? Number(userVote) : null,
        })
      ),
      page,
      limit,
    });
  } catch (error) {
    console.error("Erro ao buscar posts curtidos pelo usuário:", error);
    return NextResponse.json(
      { error: "Erro ao buscar posts curtidos" },
      { status: 500 }
    );
  }
}
