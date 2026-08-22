import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { worlds } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NpcManager } from "@/components/npcs/NpcManager";

export default async function WorldPage({
  params,
}: {
  params: Promise<{ id: string; worldId: string }>;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const { id, worldId } = await params;

  const [world] = await db
    .select()
    .from(worlds)
    .where(eq(worlds.id, worldId))
    .limit(1);

  if (!world || world.campaignId !== id) {
    notFound();
  }

  return <NpcManager worldId={worldId} worldName={world.name} />;
}
