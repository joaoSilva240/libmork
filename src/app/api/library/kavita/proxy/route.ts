import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { getKavitaConfig, safeFetchKavita, validateKavitaTargetUrl } from "@/lib/kavita/config";
import { logger } from "@/lib/logger";

/**
 * GET /api/library/kavita/proxy
 * Proxy autenticado e seguro para capas e arquivos PDF do Kavita.
 * Suporta streaming, Range headers (Accept-Ranges: bytes) para visualizador de PDF (PdfViewerModal).
 * Protegido contra SSRF: apenas endereços validados sob o servidor Kavita são permitidos.
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
    const targetUrlParam = searchParams.get("url");
    const typeParam = searchParams.get("type"); // 'image' | 'pdf'

    if (!targetUrlParam) {
      return NextResponse.json(
        { success: false, error: "Parâmetro 'url' é obrigatório" },
        { status: 400 }
      );
    }

    const config = getKavitaConfig();
    if (!config.isConfigured) {
      return NextResponse.json(
        { success: false, error: "Kavita não configurado no servidor" },
        { status: 503 }
      );
    }

    // Resolve URL relativa para o baseUrl do Kavita se necessário
    let resolvedUrl = targetUrlParam;
    if (resolvedUrl.startsWith("/")) {
      resolvedUrl = `${config.baseUrl}${resolvedUrl}`;
    }

    // SSRF Check
    const validation = validateKavitaTargetUrl(resolvedUrl);
    if (!validation.valid || !validation.url) {
      return NextResponse.json(
        { success: false, error: validation.error || "Destino não autorizado" },
        { status: 403 }
      );
    }

    // Validação de hostname: o host de destino deve ser o mesmo de KAVITA_URL
    const configuredUrl = new URL(config.baseUrl);
    const targetPort = validation.url.port || (validation.url.protocol === "https:" ? "443" : "80");
    const configuredPort = configuredUrl.port || (configuredUrl.protocol === "https:" ? "443" : "80");

    if (
      validation.url.hostname.toLowerCase() !== configuredUrl.hostname.toLowerCase() ||
      targetPort !== configuredPort
    ) {
      return NextResponse.json(
        { success: false, error: "Host alvo não corresponde ao servidor Kavita configurado." },
        { status: 403 }
      );
    }

    // Validação de tipo e destino interno
    const isWebReaderDestination = (url: string): boolean => {
      const lower = url.toLowerCase();
      return (
        lower.includes("incognitomode=") ||
        lower.includes("/pdf/") ||
        lower.includes("/reader") ||
        lower.includes("/book/")
      );
    };

    if (typeParam === "pdf" && isWebReaderDestination(resolvedUrl)) {
      return NextResponse.json(
        {
          success: false,
          error: "Destino corresponde ao leitor web do Kavita, não a um arquivo PDF para download/streaming.",
        },
        { status: 400 }
      );
    }

    // Repassa headers relevantes (como Range para streaming de PDF)
    const forwardHeaders: Record<string, string> = {
      Accept: typeParam === "image" ? "image/*" : "application/pdf, */*",
    };

    // Autenticação HTTP Basic para OPDS Kavita se apiKey estiver configurada
    // Conforme especificação OPDS / Kavita: usuário ou token no Basic Auth
    // Kavita aceita a OPDS key tanto na URL quanto como Basic Auth / Bearer token
    if (config.apiKey) {
      const basicAuthToken = Buffer.from(`${config.apiKey}:${config.apiKey}`).toString("base64");
      forwardHeaders["Authorization"] = `Basic ${basicAuthToken}`;
    }

    const rangeHeader = request.headers.get("range");
    if (rangeHeader) {
      forwardHeaders["Range"] = rangeHeader;
    }

    const upstreamRes = await safeFetchKavita(resolvedUrl, {
      method: "GET",
      headers: forwardHeaders,
    });

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      const isBadReq = upstreamRes.status === 400;
      const errorMsg = isBadReq
        ? "Requisição inválida ao servidor Kavita (400 Bad Request). Verifique se o link de acquisition/download é suportado ou se requer chave OPDS válida."
        : `Falha ao obter recurso do Kavita: ${upstreamRes.status} ${upstreamRes.statusText}`;

      return NextResponse.json(
        {
          success: false,
          error: errorMsg,
          statusCode: upstreamRes.status,
        },
        { status: upstreamRes.status }
      );
    }

    const responseHeaders = new Headers();
    const rawContentType = upstreamRes.headers.get("content-type") || "";
    
    // Rejeita resposta HTML quando type=pdf (Kavita retornando tela de leitor web ou página de erro em vez de binário)
    if (typeParam === "pdf") {
      const lowerCt = rawContentType.toLowerCase();
      if (lowerCt.includes("text/html") || lowerCt.includes("application/xhtml")) {
        return NextResponse.json(
          {
            success: false,
            error: "O servidor Kavita retornou HTML em vez de um arquivo PDF. Este recurso é um leitor web ou não possui download direto disponível.",
          },
          { status: 422 }
        );
      }
    }

    const contentType = rawContentType || (typeParam === "image" ? "image/jpeg" : "application/pdf");
    responseHeaders.set("Content-Type", contentType);

    const contentLength = upstreamRes.headers.get("content-length");
    if (contentLength) {
      responseHeaders.set("Content-Length", contentLength);
    }

    const acceptRanges = upstreamRes.headers.get("accept-ranges") || "bytes";
    responseHeaders.set("Accept-Ranges", acceptRanges);

    const contentRange = upstreamRes.headers.get("content-range");
    if (contentRange) {
      responseHeaders.set("Content-Range", contentRange);
    }

    // Headers de segurança e embedding same-origin
    responseHeaders.set("Content-Disposition", "inline");
    responseHeaders.set("X-Content-Type-Options", "nosniff");
    responseHeaders.set("Cache-Control", "private, max-age=3600");

    return new NextResponse(upstreamRes.body, {
      status: upstreamRes.status,
      headers: responseHeaders,
    });
  } catch (error) {
    logger.error({ err: error }, "Erro no proxy seguro do Kavita");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor ao processar proxy" },
      { status: 500 }
    );
  }
}
