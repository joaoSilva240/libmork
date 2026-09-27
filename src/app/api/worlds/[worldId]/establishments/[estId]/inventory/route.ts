import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { establishmentInventory, establishments } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ worldId: string; estId: string }> }
) {
  try {
    const { estId } = await params;
    const items = await db
      .select()
      .from(establishmentInventory)
      .where(eq(establishmentInventory.establishmentId, estId))
      .orderBy(desc(establishmentInventory.createdAt));

    return NextResponse.json({ success: true, data: items });
  } catch (err) {
    console.error("[Get Establishment Inventory Error]:", err);
    return NextResponse.json({ error: "Erro ao buscar inventário" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ worldId: string; estId: string }> }
) {
  try {
    const session = await getSession(); const user = session?.user;
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { estId } = await params;
    const body = await req.json();
    const { name, description, contentType, priceGold, stock, contentId } = body;

    if (!name) {
      return NextResponse.json({ error: "Nome do produto é obrigatório" }, { status: 400 });
    }

    const [newItem] = await db
      .insert(establishmentInventory)
      .values({
        establishmentId: estId,
        name,
        description: description || null,
        contentType: contentType || "items",
        contentId: contentId || null,
        priceGold: Number(priceGold) || 0,
        stock: Number(stock) != null ? Number(stock) : -1,
      })
      .returning();

    return NextResponse.json({ success: true, data: newItem }, { status: 201 });
  } catch (err) {
    console.error("[Create Establishment Inventory Item Error]:", err);
    return NextResponse.json({ error: "Erro ao adicionar produto" }, { status: 500 });
  }
}
