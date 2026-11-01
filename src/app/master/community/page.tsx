import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import CommunityFeed from "@/components/community/CommunityFeed";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export default async function MasterCommunityPage() {
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const [user] = await db
    .select({
      id: users.id,
      masterName: users.masterName,
      masterAvatar: users.masterAvatar,
      displayName: users.displayName,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 overflow-hidden">
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <CommunityFeed
          currentUser={{
            id: session.user.id,
            masterName: user?.masterName ?? null,
            masterAvatar: user?.masterAvatar ?? null,
            displayName: user?.displayName ?? null,
          }}
        />
      </div>
    </div>
  );
}
