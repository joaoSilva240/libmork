import { NextRequest, NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { communityComments, communityLikes, communityPosts, users } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";

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
        likesCount: sql<number>`count(distinct ${communityLikes.userId})`,
        commentsCount: sql<number>`count(distinct ${communityComments.id})`,
        isLikedByMe: session
          ? sql<boolean>`bool_or(${communityLikes.userId} = ${session.user.id})`
          : sql<boolean>`false`,
      })
      .from(communityPosts)
      .innerJoin(users, eq(users.id, communityPosts.authorId))
      .leftJoin(communityLikes, eq(communityLikes.postId, communityPosts.id))
      .leftJoin(communityComments, eq(communityComments.postId, communityPosts.id))
      .where(eq(communityPosts.authorId, userId))
      .groupBy(communityPosts.id, users.id)
      .orderBy(desc(communityPosts.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    return NextResponse.json({
      success: true,
      data: rows.map(({ post, author, likesCount, commentsCount, isLikedByMe }) => ({
        ...post,
        author,
        likesCount: Number(likesCount),
        commentsCount: Number(commentsCount),
        isLikedByMe: Boolean(isLikedByMe),
      })),
      page,
      limit,
    });
  } catch (error) {
    console.error("Erro ao buscar posts do usuário:", error);
    return NextResponse.json(
      { error: "Erro ao buscar posts do usuário" },
      { status: 500 }
    );
  }
}
