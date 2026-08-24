import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { items } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { translateContentWithLLM } from "@/lib/server/content-translation";

type RouteContext = { params: Promise<{ itemId: string }> };

export async function POST(_request: NextRequest, { params }: RouteContext) {
  try {
    if (!(await requireAuth())) return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
    const { itemId } = await params;
    if (!z.uuid().safeParse(itemId).success) return NextResponse.json({ success: false, error: "ID de item inválido" }, { status: 400 });
    const [item] = await db.select().from(items).where(eq(items.id, itemId)).limit(1);
    if (!item) return NextResponse.json({ success: false, error: "Item não encontrado" }, { status: 404 });
    if (item.translation) return NextResponse.json({ success: true, translation: item.translation });

    const translation = await translateContentWithLLM("item", {
      name: item.name,
      description: item.description,
      qualityDescription: item.qualityDescription,
      counterpointDescription: item.counterpointDescription,
      sourceData: item.sourceData,
    });
    await db.update(items).set({ translation }).where(eq(items.id, itemId));
    return NextResponse.json({ success: true, translation });
  } catch (error) {
    console.error("Erro seguro ao traduzir item:", error instanceof Error ? error.message : "erro desconhecido");
    return NextResponse.json({ success: false, error: "Erro ao traduzir item via IA" }, { status: 500 });
  }
}
