// =============================================================================
// Libmork — Audio: Extração de ID e Utilitários de Vídeo do YouTube (Issue #60)
// =============================================================================

const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

// 11 caracteres válidos seguidos de um caractere fora do alfabeto de IDs
// (permite sanitizar sufixos como "?si=..." ou "&t=90s" colados no path,
// mas rejeita IDs com 10 ou 12 caracteres)
const YOUTUBE_PATH_ID_PATTERN = /^[A-Za-z0-9_-]{11}(?![A-Za-z0-9_-])/;

// youtube.com, youtu.be e subdomínios comuns (www, m, music) — mas não
// domínios que apenas terminam com o sufixo (ex.: notyoutube.com)
const YOUTUBE_HOST_PATTERN = /(^|\.)(youtube\.com|youtu\.be)$/;

/**
 * Extrai o ID de vídeo do YouTube (11 caracteres) de uma URL.
 */
export function extractYouTubeId(url: string): string | null {
  if (typeof url !== "string" || url.trim() === "") {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  if (!YOUTUBE_HOST_PATTERN.test(host)) {
    return null;
  }

  // Regra: "v=" prevalece (watch de vídeo dentro de playlist é tocável)
  const vParam = parsed.searchParams.get("v");
  if (vParam !== null && YOUTUBE_ID_PATTERN.test(vParam)) {
    return vParam;
  }

  // https://youtu.be/VIDEO_ID (sem www)
  if (host === "youtu.be" || host.endsWith(".youtu.be")) {
    const segment = parsed.pathname.split("/").filter(Boolean)[0] ?? "";
    const match = segment.match(YOUTUBE_PATH_ID_PATTERN);
    return match ? match[0] : null;
  }

  // https://www.youtube.com/shorts/VIDEO_ID e /embed/VIDEO_ID
  const pathMatch = parsed.pathname.match(
    /\/(?:shorts|embed)\/([A-Za-z0-9_-]{11}(?![A-Za-z0-9_-]))/,
  );
  if (pathMatch) {
    return pathMatch[1];
  }

  // /watch sem "?v=" válido e /playlist?list=... sem vídeo → não tocável
  return null;
}

/**
 * Retorna a URL da imagem de miniatura (thumbnail) do vídeo do YouTube.
 * Opções de qualidade: 'hq' (480x360), 'mq' (320x180), 'default' (120x90).
 */
export function getYouTubeThumbnailUrl(
  videoId: string,
  quality: "hq" | "mq" | "default" = "hq",
): string {
  const fileName =
    quality === "hq" ? "hqdefault.jpg" : quality === "mq" ? "mqdefault.jpg" : "default.jpg";
  return `https://img.youtube.com/vi/${videoId}/${fileName}`;
}

/**
 * Formata segundos num formato legível de tempo (ex: "1:23" ou "1:05:30").
 */
export function formatAudioTime(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  const paddedSecs = secs < 10 ? `0${secs}` : `${secs}`;

  if (hrs > 0) {
    const paddedMins = mins < 10 ? `0${mins}` : `${mins}`;
    return `${hrs}:${paddedMins}:${paddedSecs}`;
  }

  return `${mins}:${paddedSecs}`;
}
