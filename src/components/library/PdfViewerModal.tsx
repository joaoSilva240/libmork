"use client";

import React, { useEffect } from "react";
import { Button } from "@/components/ui";

interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  url?: string;
  provider: string;
  externalUrl?: string;
  pdfProxyUrl?: string | null;
  acquisitionUrl?: string | null;
  webReaderUrl?: string | null;
}

/**
 * Converte a URL do documento para o link apropriado de visualização em iframe:
 * - Se provider === "smb": /api/library/documents/stream?file={encodeURIComponent(externalUrl)}
 * - Se provider === "gdrive" ou url do Google Drive: converte para /preview se necessário
 * - Se provider === "kavita": SEMPRE aponta para /api/library/kavita/proxy?url=...&type=pdf APENAS quando há pdfProxyUrl/acquisitionUrl real
 * - Se for URL já pronta ou externa: usa a URL indicada
 */
export function resolvePdfEmbedUrl(doc: {
  externalUrl?: string | null;
  url?: string | null;
  provider?: string | null;
  pdfProxyUrl?: string | null;
  acquisitionUrl?: string | null;
  webReaderUrl?: string | null;
}): { embedUrl: string | null; isDirectEmbedPossible: boolean } {
  const provider = (doc.provider || "").toLowerCase();

  // Candidatos em ordem de prioridade para embed de PDF direto
  // IMPORTANTE: webReaderUrl NUNCA deve ser embutido como embedUrl de PDF para evitar tela quebrada do leitor web
  const candidates = [
    doc.pdfProxyUrl,
    doc.acquisitionUrl,
    doc.externalUrl,
    doc.url,
  ];

  let rawCandidate: string | null = null;
  for (const c of candidates) {
    if (typeof c === "string") {
      const trimmed = c.trim();
      if (trimmed.length > 0) {
        // Não aceita caminhos que são leitor web como candidato a PDF
        if (
          !trimmed.includes("incognitoMode=") &&
          !trimmed.includes("/pdf/") &&
          !trimmed.includes("/reader")
        ) {
          rawCandidate = trimmed;
          break;
        }
      }
    }
  }

  if (!rawCandidate) {
    return { embedUrl: null, isDirectEmbedPossible: false };
  }

  if (provider === "smb" || rawCandidate.startsWith("smb://") || rawCandidate.startsWith("smb:\\")) {
    const streamUrl = `/api/library/documents/stream?file=${encodeURIComponent(rawCandidate)}`;
    return { embedUrl: streamUrl, isDirectEmbedPossible: true };
  }

  // Kavita OPDS: se for endpoint de proxy (/api/library/kavita/proxy) ou link direto de aquisição do Kavita
  if (
    provider === "kavita" ||
    rawCandidate.includes("/api/library/kavita/proxy") ||
    rawCandidate.includes(":5150") ||
    rawCandidate.includes("/api/opds/")
  ) {
    if (rawCandidate.startsWith("/api/library/kavita/proxy")) {
      // Se já contém ?url=, garante que contenha type=pdf se aplicável
      if (rawCandidate.includes("url=")) {
        const hasType = rawCandidate.includes("type=");
        const embedUrl = hasType ? rawCandidate : `${rawCandidate}&type=pdf`;
        return { embedUrl, isDirectEmbedPossible: true };
      }
    }

    // Se veio a acquisitionUrl ou a URL direta do Kavita
    const targetUrl =
      (typeof doc.acquisitionUrl === "string" && doc.acquisitionUrl.trim()) ||
      (rawCandidate.startsWith("/api/library/kavita/proxy") ? "" : rawCandidate) ||
      (typeof doc.externalUrl === "string" && doc.externalUrl.trim()) ||
      (typeof doc.url === "string" && doc.url.trim()) ||
      "";

    const cleanTarget = targetUrl.trim();
    if (cleanTarget) {
      const embedUrl = `/api/library/kavita/proxy?url=${encodeURIComponent(cleanTarget)}&type=pdf`;
      return { embedUrl, isDirectEmbedPossible: true };
    }

    return { embedUrl: null, isDirectEmbedPossible: false };
  }

  // Google Drive: precisa ser /preview para rodar em iframe sem bloqueio do Google
  if (provider === "gdrive" || rawCandidate.includes("drive.google.com")) {
    let embedUrl = rawCandidate;
    // Ex: https://drive.google.com/file/d/FILE_ID/view -> .../preview
    if (embedUrl.includes("/view")) {
      embedUrl = embedUrl.replace(/\/view(\?.*)?$/, "/preview");
    } else if (embedUrl.includes("id=")) {
      // Ex: https://drive.google.com/open?id=FILE_ID
      const match = embedUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (match) {
        embedUrl = `https://drive.google.com/file/d/${match[1]}/preview`;
      }
    } else if (!embedUrl.endsWith("/preview")) {
      embedUrl = embedUrl.replace(/\/?$/, "/preview");
    }
    return { embedUrl, isDirectEmbedPossible: true };
  }

  // Se for Notion ou GitBook ou outro serviço externo que pode bloquear X-Frame-Options
  return {
    embedUrl: rawCandidate,
    isDirectEmbedPossible: true,
  };
}

export function PdfViewerModal({
  isOpen,
  onClose,
  title,
  url,
  provider,
  externalUrl,
  pdfProxyUrl,
  acquisitionUrl,
  webReaderUrl,
}: PdfViewerModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const { embedUrl } = resolvePdfEmbedUrl({
    externalUrl: url || externalUrl,
    url,
    provider,
    pdfProxyUrl,
    acquisitionUrl,
    webReaderUrl,
  });

  const rawTargetCandidates = [
    pdfProxyUrl,
    acquisitionUrl,
    externalUrl,
    url,
  ];
  let rawTarget: string | null = null;
  for (const c of rawTargetCandidates) {
    if (typeof c === "string") {
      const trimmed = c.trim();
      if (
        trimmed.length > 0 &&
        !trimmed.includes("incognitoMode=") &&
        !trimmed.includes("/pdf/") &&
        !trimmed.includes("/reader")
      ) {
        rawTarget = trimmed;
        break;
      }
    }
  }

  let originalLink: string | null = null;
  if (rawTarget) {
    if (provider === "smb") {
      originalLink = `/api/library/documents/stream?file=${encodeURIComponent(rawTarget)}`;
    } else if (provider === "kavita") {
      originalLink = embedUrl || rawTarget;
    } else {
      originalLink = rawTarget;
    }
  }

  const kavitaWebLink = webReaderUrl || (url && url.includes("incognitoMode=") ? url : null);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdf-viewer-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full h-[94vh] max-w-6xl rounded-2xl border border-purple-900/60 bg-gray-950 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header do Modal */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900/80">
          <div className="flex items-center gap-3 overflow-hidden">
            <span className="text-xl">📜</span>
            <div className="truncate">
              <h2
                id="pdf-viewer-title"
                className="text-sm sm:text-base font-bold text-white truncate"
              >
                {title}
              </h2>
              <p className="text-xs text-purple-400 truncate">
                Provedor: <span className="uppercase font-semibold">{provider}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Se só houver webReaderUrl ou se houver link web do Kavita */}
            {kavitaWebLink && (
              <a
                href={kavitaWebLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-800/60 bg-amber-950/50 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-900/60 transition"
                title="Abrir no leitor web oficial do Kavita"
              >
                <span>Abrir no Kavita</span>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}

            {/* Fallback: Abrir original em nova aba apenas se houver URL original com arquivo PDF */}
            {originalLink && (
              <a
                href={originalLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-purple-800/60 bg-purple-950/50 px-3 py-1.5 text-xs font-semibold text-purple-200 hover:bg-purple-900/60 transition"
                title="Abrir arquivo em nova aba"
              >
                <span>Abrir original</span>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}

            {/* Fechar */}
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="!px-2.5 !py-1 text-xs"
              aria-label="Fechar visualizador"
            >
              ✕
            </Button>
          </div>
        </div>

        {/* Corpo com Iframe ou Estado Informativo/Fallback */}
        <div className="relative flex-1 w-full bg-gray-900 overflow-hidden">
          {embedUrl ? (
            <iframe
              src={embedUrl}
              title={title}
              className="w-full h-full border-0 bg-gray-950"
              allow="fullscreen; autoplay"
            />
          ) : kavitaWebLink ? (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center text-gray-400">
              <span className="text-4xl mb-3">📖</span>
              <p className="text-sm font-semibold text-gray-200 mb-1">
                Leitor Web do Kavita
              </p>
              <p className="text-xs text-gray-400 max-w-md mb-4">
                Este documento não possui download direto de arquivo PDF no catálogo OPDS, mas está disponível para leitura no Kavita.
              </p>
              <a
                href={kavitaWebLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold px-4 py-2.5 shadow-lg transition"
              >
                <span>Abrir no Kavita</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center text-gray-400">
              <span className="text-4xl mb-3">⚠️</span>
              <p className="text-sm font-semibold text-gray-200 mb-1">
                Não foi possível carregar o documento
              </p>
              <p className="text-xs text-gray-400 max-w-md">
                Nenhum link ou endereço válido de visualização foi fornecido para este documento.
              </p>
            </div>
          )}
        </div>

        {/* Footer com dica / status */}
        <div className="px-4 py-2 bg-gray-950 border-t border-gray-800/80 flex items-center justify-between text-[11px] text-gray-400">
          <span>
            {kavitaWebLink && !embedUrl ? (
              <>Disponível para leitura na interface web do Kavita.</>
            ) : originalLink ? (
              <>
                Caso o leitor embutido falhe devido às políticas do provedor ({provider}), use o botão <strong>Abrir original</strong> acima.
              </>
            ) : (
              <>Provedor: <span className="uppercase font-semibold">{provider}</span></>
            )}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-purple-400 hover:text-purple-300 font-medium"
          >
            Fechar Janela
          </button>
        </div>
      </div>
    </div>
  );
}
