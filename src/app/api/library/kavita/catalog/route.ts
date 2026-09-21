import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { getKavitaCatalog } from "@/lib/kavita/service";
import { logger } from "@/lib/logger";

/**
 * GET /api/library/kavita/catalog
 * Retorna catálogo OPDS do Kavita traduzido para itens do Libmork.
 * Restrito para usuários autenticados (Mestres na área de biblioteca).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || undefined;

    const catalog = await getKavitaCatalog(q);

    return NextResponse.json({
      success: true,
      data: catalog,
    });
  } catch (error) {
    logger.error({ err: error }, "Erro na rota de catálogo Kavita");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
