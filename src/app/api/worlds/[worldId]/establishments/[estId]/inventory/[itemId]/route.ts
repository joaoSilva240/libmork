import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { establishmentInventory } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ worldId: string; estId: string; itemId: string }> }
) {
  try {
    const session = await getSession();
    const user = session?.user;
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { itemId } = await params;
    await db.delete(establishmentInventory).where(eq(establishmentInventory.id, itemId));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Delete Inventory Item Error]:", err);
    return NextResponse.json({ error: "Erro ao remover item" }, { status: 500 });
  }
}
