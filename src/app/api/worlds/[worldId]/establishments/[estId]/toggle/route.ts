import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { establishments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ worldId: string; estId: string }> }
) {
  try {
    const session = await getSession(); const user = session?.user;
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { estId } = await params;
    const body = await req.json();
    const { isOpen, trustLevel } = body;

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (isOpen !== undefined) {
      updateData.isOpen = Boolean(isOpen);
    }
    if (trustLevel !== undefined) {
      updateData.trustLevel = Number(trustLevel);
    }

    const [updated] = await db
      .update(establishments)
      .set(updateData)
      .where(eq(establishments.id, estId))
      .returning();

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("[Toggle Establishment Error]:", err);
    return NextResponse.json({ error: "Erro ao alternar status do estabelecimento" }, { status: 500 });
  }
}
