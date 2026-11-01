import { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { campaigns, communityPosts, users } from "@/lib/db/schema";
import MasterProfile from "@/components/community/MasterProfile";

type Props = {
  params: Promise<{ userId: string }>;
};

export const metadata: Metadata = {
  title: "Perfil de Mestre | Libmork",
  description: "Perfil público de mestre na comunidade Libmork",
};

async function getProfileData(userId: string) {
  try {
    // Busca dados do usuário diretamente do banco
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
      return null;
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
      sessions: 0,
      spells: Number(postStats?.spells ?? 0),
      items: Number(postStats?.items ?? 0),
      classes: Number(postStats?.classes ?? 0),
      npcs: Number(postStats?.npcs ?? 0),
      worlds: Number(postStats?.worlds ?? 0),
    };

    return {
      id: user.id,
      displayName: user.displayName,
      masterName: user.masterName || user.displayName,
      masterAvatar: user.masterAvatar || null,
      masterBio: user.masterBio || null,
      masterBannerUrl: user.masterBannerUrl || null,
      statistics: stats,
    };
  } catch (error) {
    console.error("Erro ao buscar perfil de mestre:", error);
    return null;
  }
}

export default async function MasterProfilePage({ params }: Props) {
  const { userId } = await params;
  const session = await getSession();
  const profileData = await getProfileData(userId);

  if (!profileData) {
    notFound();
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <MasterProfile
          userId={userId}
          profileData={profileData}
          currentUserId={session?.user?.id}
        />
      </div>
    </div>
  );
}
