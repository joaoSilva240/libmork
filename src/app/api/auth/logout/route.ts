// =============================================================================
// Libmork — API Route: Logout (RF-004)
// =============================================================================

import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth/session";
import { logger } from "@/lib/logger";

export async function POST() {
  try {
    await destroySession();
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Erro ao fazer logout");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
