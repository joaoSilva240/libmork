import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { libraryDocuments } from "@/lib/db/schema";
import { resolveSafeLibraryPath } from "@/lib/library/storage";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { logger } from "@/lib/logger";

/**
 * GET /api/library/documents/stream
 * Rota segura de streaming para arquivos no path SMB/compartilhamento configurado.
 * Parâmetro: ?file=... ou ?docId=...
 *
 * Segurança:
 * - Sanitização rigorosa contra Path Traversal
 * - Verifica se LIBRARY_SMB_PATH está configurado
 * - Verifica existência do arquivo no disco
 * - Retorna Content-Type: application/pdf, Content-Disposition: inline, Accept-Ranges: bytes
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileParam = searchParams.get("file");
    const docIdParam = searchParams.get("docId");

    let targetFilePath = fileParam;

    // Se docId for passado, buscar a externalUrl no banco
    if (!targetFilePath && docIdParam) {
      const [doc] = await db
        .select()
        .from(libraryDocuments)
        .where(eq(libraryDocuments.id, docIdParam))
        .limit(1);

      if (!doc) {
        return NextResponse.json(
          { success: false, error: "Documento não encontrado" },
          { status: 404 }
        );
      }

      targetFilePath = doc.externalUrl;
    }

    if (!targetFilePath) {
      return NextResponse.json(
        {
          success: false,
          error: "Parâmetro 'file' ou 'docId' é obrigatório para streaming",
        },
        { status: 400 }
      );
    }

    // Se for URL externa web (http/https), o streaming local via SMB não se aplica
    if (
      targetFilePath.startsWith("http://") ||
      targetFilePath.startsWith("https://")
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Documento é uma URL web externa. Abra diretamente através do link fornecido.",
        },
        { status: 400 }
      );
    }

    // Valida e resolve caminho de forma segura
    const pathResolution = resolveSafeLibraryPath(targetFilePath);

    if (!pathResolution.success || !pathResolution.resolvedPath) {
      const isConfigError =
        pathResolution.error?.includes("LIBRARY_SMB_PATH não está configurado");
      return NextResponse.json(
        {
          success: false,
          error: pathResolution.error || "Acesso a arquivo inválido",
        },
        { status: isConfigError ? 503 : 400 }
      );
    }

    const fullFilePath = pathResolution.resolvedPath;

    // Verifica se arquivo existe e se é arquivo regular
    let stat: fs.Stats;
    try {
      stat = await fs.promises.stat(fullFilePath);
      if (!stat.isFile()) {
        return NextResponse.json(
          { success: false, error: "O caminho especificado não é um arquivo" },
          { status: 400 }
        );
      }
    } catch (err: any) {
      if (err.code === "ENOENT") {
        return NextResponse.json(
          {
            success: false,
            error: "Arquivo não encontrado no diretório de biblioteca SMB",
          },
          { status: 404 }
        );
      }
      logger.error({ err, fullFilePath }, "Erro ao acessar arquivo no SMB");
      return NextResponse.json(
        {
          success: false,
          error: "Armazenamento SMB indisponível ou erro de permissão",
        },
        { status: 503 }
      );
    }

    const fileName = path.basename(fullFilePath);
    const fileSize = stat.size;

    // Suporte a Range Request (Accept-Ranges: bytes)
    const rangeHeader = request.headers.get("range");

    if (rangeHeader && rangeHeader.startsWith("bytes=")) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize || start > end) {
        return new NextResponse(null, {
          status: 416,
          headers: {
            "Content-Range": `bytes */${fileSize}`,
          },
        });
      }

      const chunkSize = end - start + 1;
      const nodeStream = fs.createReadStream(fullFilePath, { start, end });
      const webStream = Readable.toWeb(nodeStream) as ReadableStream;

      return new NextResponse(webStream, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize.toString(),
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
        },
      });
    }

    // Stream completo
    const nodeStream = fs.createReadStream(fullFilePath);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": fileSize.toString(),
        "Accept-Ranges": "bytes",
        "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Erro inesperado ao realizar streaming de PDF");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
