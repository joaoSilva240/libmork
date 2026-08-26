import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { items } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { translateContentWithLLM } from "@/lib/server/content-translation";
import { extractErrorCode, getStatusForCode, TranslationErrorCode } from "@/lib/server/ninerouter";

type RouteContext = { params: Promise<{ itemId: string }> };

export async function POST(_request: NextRequest, { params }: RouteContext) {
  const start = Date.now();
  let itemIdForLog = "unknown";

  try {
    if (!(await requireAuth())) {
      return NextResponse.json(
        { success: false, error: "Não autenticado", code: "unauthenticated" },
        { status: 401 }
      );
    }

    const { itemId } = await params;
    itemIdForLog = itemId;

    if (!z.uuid().safeParse(itemId).success) {
      return NextResponse.json(
        { success: false, error: "ID de item inválido", code: "invalid_id" },
        { status: 400 }
      );
    }

    const [item] = await db.select().from(items).where(eq(items.id, itemId)).limit(1);

    if (!item) {
      return NextResponse.json(
        { success: false, error: "Item não encontrado", code: "not_found" },
        { status: 404 }
      );
    }

    if (item.translation) {
      return NextResponse.json({ success: true, translation: item.translation });
    }

    const translation = await translateContentWithLLM("item", {
      name: item.name,
      description: item.description,
      qualityDescription: item.qualityDescription,
      counterpointDescription: item.counterpointDescription,
      sourceData: item.sourceData,
    });

    await db.update(items).set({ translation }).where(eq(items.id, itemId));

    const durationMs = Date.now() - start;
    console.log(`[translateItem] itemId=${itemId} durationMs=${durationMs} success`);

    return NextResponse.json({ success: true, translation });

  } catch (error) {
    const durationMs = Date.now() - start;
    const err = error as { code?: string; status?: number; message?: string; causeCode?: string };
    const rawCode = err?.code ?? extractErrorCode(error);
    const isTranslationCode = typeof rawCode === "string" && rawCode.startsWith("translation_provider_");
    const mappedCode: TranslationErrorCode = isTranslationCode ? (rawCode as TranslationErrorCode) : "translation_provider_unreachable";

    // Use getStatusForCode for consistent HTTP status mapping
    const status = isTranslationCode ? getStatusForCode(mappedCode) : 502;

    // Truncate details for safety (never expose KEY)
    const details = (err?.message || "").slice(0, 500);

    // Log error with granular code
    if (status >= 500) {
      console.error(
        `[translateItem] itemId=${itemIdForLog} durationMs=${durationMs} error.code=${mappedCode} ` +
        `cause=${err?.causeCode || ""} status=${status} details=${details.slice(0, 200)}`
      );
    } else {
      console.warn(
        `[translateItem] itemId=${itemIdForLog} durationMs=${durationMs} error.code=${mappedCode} status=${status}`
      );
    }

    // Build client-facing error message
    let clientError: string = mappedCode;
    if (mappedCode.startsWith("translation_provider_http_")) {
      const snippet = details.includes(":") ? details.split(":").slice(1).join(":").trim().slice(0, 200) : "";
      clientError = `${mappedCode}: ${snippet}`;
    }

    // Avoid leaking KEY via details
    return NextResponse.json(
      { success: false, error: clientError, code: mappedCode, details: details.slice(0, 500) },
      { status }
    );
  }
}