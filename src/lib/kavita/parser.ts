export interface OpdsLink {
  rel: string;
  type?: string;
  href: string;
  title?: string;
}

export interface OpdsEntry {
  id: string;
  title: string;
  summary?: string;
  updated?: string;
  author?: string;
  coverUrl?: string;
  thumbnailUrl?: string;
  acquisitionUrl?: string;
  webReaderUrl?: string;
  downloadUrl?: string;
  volumeUrl?: string;
  chapterUrl?: string;
  subFeedUrls?: string[];
  links: OpdsLink[];
  format?: string;
}

export interface OpdsFeedResult {
  id: string;
  title: string;
  updated?: string;
  totalResults?: number;
  itemsPerPage?: number;
  startIndex?: number;
  links: OpdsLink[];
  nextPageUrl?: string;
  prevPageUrl?: string;
  entries: OpdsEntry[];
}

/**
 * Utility to unescape basic XML entities
 */
function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * Simple, robust regex-based XML attribute parser
 */
function parseAttributes(tagContent: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex = /([a-zA-Z0-9_:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match;
  while ((match = attrRegex.exec(tagContent)) !== null) {
    const key = match[1];
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    attrs[key] = decodeXmlEntities(value);
  }
  return attrs;
}

/**
 * Robust, zero-dependency XML parser for OPDS/Atom feeds returned by Kavita and other OPDS 1.2 catalogs.
 */
export function parseOpdsXml(xmlString: string, baseUrl?: string): OpdsFeedResult {
  if (!xmlString || typeof xmlString !== "string") {
    throw new Error("XML OPDS vazio ou inválido");
  }

  // Remove XML comments
  const cleanXml = xmlString.replace(/<!--[\s\S]*?-->/g, "");

  // Feed-level metadata
  const feedTitleMatch = cleanXml.match(/<feed[^>]*>[\s\S]*?<title[^>]*>([\s\S]*?)<\/title>/i);
  const feedIdMatch = cleanXml.match(/<feed[^>]*>[\s\S]*?<id[^>]*>([\s\S]*?)<\/id>/i);
  const feedUpdatedMatch = cleanXml.match(/<feed[^>]*>[\s\S]*?<updated[^>]*>([\s\S]*?)<\/updated>/i);
  const totalMatch = cleanXml.match(/<(?:[a-zA-Z0-9_-]+:)?totalResults[^>]*>(\d+)<\//i);
  const itemsPerPageMatch = cleanXml.match(/<(?:[a-zA-Z0-9_-]+:)?itemsPerPage[^>]*>(\d+)<\//i);
  const startIndexMatch = cleanXml.match(/<(?:[a-zA-Z0-9_-]+:)?startIndex[^>]*>(\d+)<\//i);

  const resolveHref = (href: string): string => {
    if (!href) return "";
    if (href.startsWith("http://") || href.startsWith("https://")) {
      return href;
    }
    if (baseUrl) {
      try {
        return new URL(href, baseUrl).toString();
      } catch {
        return href;
      }
    }
    return href;
  };

  // Find feed-level links (before first <entry>)
  const feedLinks: OpdsLink[] = [];
  const firstEntryIndex = cleanXml.search(/<entry[\s>]/i);
  const feedHeader = firstEntryIndex > -1 ? cleanXml.slice(0, firstEntryIndex) : cleanXml;

  const linkRegex = /<link\b([^>]*?)(?:\/>|>(?:<\/link>)?)/gi;
  let linkMatch;
  while ((linkMatch = linkRegex.exec(feedHeader)) !== null) {
    const attrs = parseAttributes(linkMatch[1]);
    if (attrs.href) {
      feedLinks.push({
        rel: attrs.rel || "",
        type: attrs.type,
        href: resolveHref(attrs.href),
        title: attrs.title,
      });
    }
  }

  const nextLink = feedLinks.find((l) => l.rel === "next")?.href;
  const prevLink = feedLinks.find((l) => l.rel === "prev")?.href;

  // Extract <entry>...</entry>
  const entries: OpdsEntry[] = [];
  const entryRegex = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
  let entryMatch;

  const pickAcquisitionAndReader = (entry: {
    format?: string;
    links: OpdsLink[];
  }): { acquisitionUrl?: string; webReaderUrl?: string } => {
    let acquisitionUrl: string | undefined;
    let webReaderUrl: string | undefined;

    // Detecta leitor web no formato Kavita (ex: /library/4/series/56/pdf/358?incognitoMode=false ou /reader ou incognitoMode)
    const isWebReaderPath = (href: string): boolean => {
      const lower = href.toLowerCase();
      return (
        lower.includes("incognitomode=") ||
        lower.includes("/pdf/") ||
        lower.includes("/reader") ||
        lower.includes("/book/")
      );
    };

    // Identifica links OPDS de aquisição genuína de arquivo PDF
    for (const l of entry.links) {
      const href = l.href;
      const type = (l.type || "").toLowerCase();
      const rel = (l.rel || "").toLowerCase();

      const isWebHtml =
        type.includes("text/html") ||
        type.includes("application/xhtml") ||
        href.includes("incognitomode=") ||
        isWebReaderPath(href);

      if (isWebHtml) {
        if (!webReaderUrl) {
          webReaderUrl = href;
        }
        continue;
      }

      const isCatalog = type.includes("atom+xml") || type.includes("opds-catalog");
      if (isCatalog) continue;

      const isOpdsAcquisitionRel = rel.includes("acquisition");
      const isPdfType = type === "application/pdf" || type === "application/pdf/download" || type.includes("pdf");
      const isDownloadUrl = href.toLowerCase().includes("download") || href.toLowerCase().endsWith(".pdf");

      if (isOpdsAcquisitionRel && (isPdfType || isDownloadUrl)) {
        if (!acquisitionUrl) {
          acquisitionUrl = href;
        }
      } else if (!acquisitionUrl && isPdfType) {
        acquisitionUrl = href;
      }
    }

    return { acquisitionUrl, webReaderUrl };
  };

  while ((entryMatch = entryRegex.exec(cleanXml)) !== null) {
    const entryXml = entryMatch[1];

    const titleM = entryXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const idM = entryXml.match(/<id[^>]*>([\s\S]*?)<\/id>/i);
    const summaryM = entryXml.match(/<(?:summary|content)[^>]*>([\s\S]*?)<\/(?:summary|content)>/i);
    const updatedM = entryXml.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i);
    const authorM = entryXml.match(/<author[^>]*>[\s\S]*?<name[^>]*>([\s\S]*?)<\/name>[\s\S]*?<\/author>/i);
    const formatM = entryXml.match(/<(?:[a-zA-Z0-9_-]+:)?format[^>]*>([\s\S]*?)<\//i);

    const title = titleM ? decodeXmlEntities(titleM[1].trim()) : "Sem título";
    const id = idM ? decodeXmlEntities(idM[1].trim()) : "";
    const summary = summaryM ? decodeXmlEntities(summaryM[1].trim()) : undefined;
    const updated = updatedM ? updatedM[1].trim() : undefined;
    const author = authorM ? decodeXmlEntities(authorM[1].trim()) : undefined;
    const format = formatM ? decodeXmlEntities(formatM[1].trim()) : undefined;

    const entryLinks: OpdsLink[] = [];
    const entryLinkRegex = /<link\b([^>]*?)(?:\/>|>(?:<\/link>)?)/gi;
    let eLinkMatch;

    let coverUrl: string | undefined;
    let thumbnailUrl: string | undefined;
    let volumeUrl: string | undefined;
    let chapterUrl: string | undefined;
    const subFeedUrls: string[] = [];

    while ((eLinkMatch = entryLinkRegex.exec(entryXml)) !== null) {
      const attrs = parseAttributes(eLinkMatch[1]);
      if (!attrs.href) continue;

      const resolved = resolveHref(attrs.href);
      const rel = attrs.rel || "";
      const type = attrs.type || "";

      entryLinks.push({
        rel,
        type,
        href: resolved,
        title: attrs.title,
      });

      if (rel.includes("image/thumbnail")) {
        thumbnailUrl = resolved;
      } else if (rel.includes("image")) {
        coverUrl = resolved;
      }

      const isCatalogLink =
        type.includes("atom+xml") ||
        type.includes("opds-catalog") ||
        rel === "subsection" ||
        rel.includes("volume") ||
        rel.includes("chapter") ||
        rel === "related";

      // Check for navigation links (sub-feeds OPDS como volume / chapter / series)
      if (
        isCatalogLink ||
        resolved.includes("/volume/") ||
        resolved.includes("/chapter/") ||
        resolved.includes("/series/")
      ) {
        if (
          !resolved.includes("/download") &&
          !resolved.endsWith(".pdf") &&
          !resolved.includes("incognitoMode=")
        ) {
          if (!subFeedUrls.includes(resolved)) {
            subFeedUrls.push(resolved);
          }
        }
      }

      if (
        rel === "subsection" ||
        rel === "alternate" ||
        rel === "related" ||
        rel.includes("volume") ||
        rel.includes("chapter")
      ) {
        if (resolved.includes("/volume/") || resolved.includes("/series/")) {
          volumeUrl = resolved;
        } else if (resolved.includes("/chapter/")) {
          chapterUrl = resolved;
        }
      }
    }

    // Default thumbnail fallback
    if (!thumbnailUrl && coverUrl) {
      thumbnailUrl = coverUrl;
    }

    const { acquisitionUrl, webReaderUrl } = pickAcquisitionAndReader({
      links: entryLinks,
      format,
    });

    entries.push({
      id,
      title,
      summary,
      updated,
      author,
      coverUrl,
      thumbnailUrl,
      acquisitionUrl,
      webReaderUrl,
      volumeUrl,
      chapterUrl,
      subFeedUrls: subFeedUrls.length > 0 ? subFeedUrls : undefined,
      links: entryLinks,
      format,
    });
  }

  return {
    id: feedIdMatch ? decodeXmlEntities(feedIdMatch[1].trim()) : "",
    title: feedTitleMatch ? decodeXmlEntities(feedTitleMatch[1].trim()) : "Catálogo Kavita",
    updated: feedUpdatedMatch ? feedUpdatedMatch[1].trim() : undefined,
    totalResults: totalMatch ? parseInt(totalMatch[1], 10) : undefined,
    itemsPerPage: itemsPerPageMatch ? parseInt(itemsPerPageMatch[1], 10) : undefined,
    startIndex: startIndexMatch ? parseInt(startIndexMatch[1], 10) : undefined,
    links: feedLinks,
    nextPageUrl: nextLink,
    prevPageUrl: prevLink,
    entries,
  };
}
