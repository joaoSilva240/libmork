import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, campaigns, communityPosts } from "@/lib/db/schema";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    // Busca dados do usuário
    const [user] = await db
      .select({
        id: users.id,
        displayName: users.displayName,
        masterName: users.masterName,
        masterAvatar: users.masterAvatar,
        masterBio: users.masterBio,
        masterBannerUrl: users.masterBannerUrl,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
    }

    // Estatísticas agregadas
    const [campaignsCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(campaigns)
      .where(eq(campaigns.masterId, userId));

    const [postStats] = await db
      .select({
        spells: sql<number>`count(case when ${communityPosts.contentType} = 'spell' then 1 end)`,
        items: sql<number>`count(case when ${communityPosts.contentType} = 'item' then 1 end)`,
        classes: sql<number>`count(case when ${communityPosts.contentType} = 'class' then 1 end)`,
        npcs: sql<number>`count(case when ${communityPosts.contentType} = 'npc' then 1 end)`,
        worlds: sql<number>`count(case when ${communityPosts.contentType} = 'world' then 1 end)`,
      })
      .from(communityPosts)
      .where(eq(communityPosts.authorId, userId));

    const stats = {
      campaigns: Number(campaignsCount?.count ?? 0),
      sessions: 0, // Sem tabela de sessões dedicada de RPG
      spells: Number(postStats?.spells ?? 0),
      items: Number(postStats?.items ?? 0),
      classes: Number(postStats?.classes ?? 0),
      npcs: Number(postStats?.npcs ?? 0),
      worlds: Number(postStats?.worlds ?? 0),
    };

    const profileData = {
      id: user.id,
      displayName: user.displayName,
      masterName: user.masterName || user.displayName,
      masterAvatar: user.masterAvatar || null,
      masterBio: user.masterBio || null,
      masterBannerUrl: user.masterBannerUrl || null,
      statistics: stats,
      stats,
    };

    return NextResponse.json({
      success: true,
      ...profileData,
      profile: profileData,
    });
  } catch (error) {
    console.error("Erro ao buscar perfil de mestre:", error);
    return NextResponse.json(
      { error: "Erro ao buscar perfil de mestre" },
      { status: 500 }
    );
  }
}
