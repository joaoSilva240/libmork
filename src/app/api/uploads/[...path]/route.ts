// =============================================================================
// Libmork — API Route: Servir Arquivos de Upload (D-33)
// =============================================================================
// Serve imagens do volume local. Sem autenticação (usado por fichas públicas).
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { getUploadsDir } from "@/lib/utils/uploads";

type RouteContext = { params: Promise<{ path: string[] }> };

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/**
 * GET /api/uploads/[...path]
 * Serve o arquivo do diretório de uploads.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { path: segments } = await params;

    // Sanitiza cada segmento para prevenir path traversal
    const safeSegments = segments.map((segment) => path.basename(segment));

    if (safeSegments.length === 0) {
      return NextResponse.json(
        { success: false, error: "Arquivo não especificado" },
        { status: 400 }
      );
    }

    const filePath = path.join(getUploadsDir(), ...safeSegments);
    const data = await readFile(filePath);

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_BY_EXT[ext] || "application/octet-stream";

    return new NextResponse(data, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Imagem não encontrada" },
      { status: 404 }
    );
  }
}
