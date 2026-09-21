import { getKavitaConfig, safeFetchKavita } from "./config";
import { parseOpdsXml, OpdsFeedResult, OpdsEntry } from "./parser";
import { logger } from "@/lib/logger";

export interface KavitaBookItem {
  id: string;
  title: string;
  summary: string;
  author?: string;
  coverUrl?: string;
  thumbnailUrl?: string;
  // Proxy endpoints on Libmork so credentials are never exposed to browser:
  pdfProxyUrl?: string;
  coverProxyUrl?: string;
  acquisitionUrl?: string;
  webReaderUrl?: string;
  format?: string;
  hasPdf: boolean;
}

export interface KavitaCatalogResponse {
  configured: boolean;
  total?: number;
  items: KavitaBookItem[];
  error?: string;
}

/**
 * Fetch and parse catalog feed from Kavita OPDS server, traversing all pages (rel="next").
 */
export async function getKavitaCatalog(searchQuery?: string): Promise<KavitaCatalogResponse> {
  const config = getKavitaConfig();
  if (!config.isConfigured) {
    return {
      configured: false,
      items: [],
      error: "KAVITA_OPDS_KEY não configurada no servidor.",
    };
  }

  try {
    let targetUrl: string;

    if (searchQuery && searchQuery.trim().length > 0) {
      // Kavita OPDS search endpoint: /api/opds/{apiKey}/series?query={searchTerms}
      const encodedQuery = encodeURIComponent(searchQuery.trim());
      targetUrl = `${config.baseUrl}/api/opds/${config.apiKey}/series?query=${encodedQuery}`;
    } else {
      // Root catalogue or libraries / recently-added
      targetUrl = `${config.baseUrl}/api/opds/${config.apiKey}/recently-added`;
    }

    let response = await safeFetchKavita(targetUrl, {
      headers: {
        Accept: "application/atom+xml, application/xml;q=0.9, */*;q=0.8",
      },
    });

    // If recently-added returns 404 or 400 (e.g. empty library), fallback to root catalogue
    if (!response.ok && !searchQuery) {
      const rootUrl = `${config.baseUrl}/api/opds/${config.apiKey}`;
      response = await safeFetchKavita(rootUrl, {
        headers: {
          Accept: "application/atom+xml, application/xml;q=0.9, */*;q=0.8",
        },
      });
      targetUrl = rootUrl;
    }

    if (!response.ok) {
      logger.warn(
        { status: response.status, statusText: response.statusText },
        "Falha na resposta do servidor OPDS Kavita"
      );
      return {
        configured: true,
        items: [],
        error: `Kavita OPDS retornou status ${response.status} (${response.statusText})`,
      };
    }

    const allEntries: OpdsEntry[] = [];
    const seenEntryIds = new Set<string>();
    const visitedUrls = new Set<string>();
    let totalResults: number | undefined;

    let currentUrl: string | undefined = targetUrl;
    let currentResponse: Response | null = response;
    const MAX_PAGES = 50; // Safeguard against circular or infinite feeds
    let pageCount = 0;

    while (currentUrl && pageCount < MAX_PAGES) {
      if (visitedUrls.has(currentUrl)) {
        break;
      }
      visitedUrls.add(currentUrl);
      pageCount++;

      let resToRead = currentResponse;
      if (!resToRead) {
        resToRead = await safeFetchKavita(currentUrl, {
          headers: {
            Accept: "application/atom+xml, application/xml;q=0.9, */*;q=0.8",
          },
        });
        if (!resToRead.ok) {
          logger.warn(
            { url: currentUrl, status: resToRead.status },
            "Falha ao carregar página seguinte do feed OPDS Kavita"
          );
          break;
        }
      }
      // Reset currentResponse after first iteration
      currentResponse = null;

      const xml = await resToRead.text();
      const feed: OpdsFeedResult = parseOpdsXml(xml, config.baseUrl);

      if (totalResults === undefined && feed.totalResults !== undefined) {
        totalResults = feed.totalResults;
      }

      for (const entry of feed.entries) {
        if (!seenEntryIds.has(entry.id)) {
          seenEntryIds.add(entry.id);
          allEntries.push(entry);
        }
      }

      currentUrl = feed.nextPageUrl;
    }

    // Processa entries, expandindo coleções e sub-feeds (volumes, capítulos) recursivamente em livros/PDFs individuais
    const items: KavitaBookItem[] = [];
    const seenBookItemIds = new Set<string>();
    const seenAcquisitionUrls = new Set<string>();
    const MAX_SUBFEEDS = 100;
    let subFeedFetchCount = 0;

    const isPdfDirect = (url?: string, format?: string): boolean => {
      if (!url) return false;
      const lower = url.toLowerCase();
      return (
        lower.includes(".pdf") ||
        lower.includes("/download") ||
        (format ? format.toLowerCase() === "pdf" : false)
      );
    };

    const addBookItem = (item: KavitaBookItem) => {
      if (item.acquisitionUrl && seenAcquisitionUrls.has(item.acquisitionUrl)) {
        return;
      }
      if (seenBookItemIds.has(item.id)) {
        return;
      }
      seenBookItemIds.add(item.id);
      if (item.acquisitionUrl) {
        seenAcquisitionUrls.add(item.acquisitionUrl);
      }
      items.push(item);
    };

    const makeBookItem = (
      subEntry: OpdsEntry,
      parentEntry?: OpdsEntry
    ): KavitaBookItem => {
      const directAcquisition = subEntry.acquisitionUrl || (parentEntry?.acquisitionUrl);
      const webReader = subEntry.webReaderUrl || parentEntry?.webReaderUrl;
      const format = subEntry.format || parentEntry?.format;
      const hasPdf = isPdfDirect(directAcquisition, format);

      const rawCover =
        subEntry.coverUrl ||
        subEntry.thumbnailUrl ||
        parentEntry?.coverUrl ||
        parentEntry?.thumbnailUrl;

      const coverProxyUrl = rawCover
        ? `/api/library/kavita/proxy?url=${encodeURIComponent(rawCover)}&type=image`
        : undefined;

      const pdfProxyUrl = hasPdf && directAcquisition
        ? `/api/library/kavita/proxy?url=${encodeURIComponent(directAcquisition)}&type=pdf`
        : undefined;

      let title = subEntry.title;
      if (parentEntry && parentEntry.title && parentEntry.title !== subEntry.title) {
        const parentLower = parentEntry.title.toLowerCase().trim();
        const subLower = subEntry.title.toLowerCase().trim();
        if (!subLower.startsWith(parentLower)) {
          title = `${parentEntry.title} - ${subEntry.title}`;
        }
      }

      const id = parentEntry && parentEntry.id !== subEntry.id
        ? `${parentEntry.id}-${subEntry.id}`
        : subEntry.id;

      return {
        id,
        title,
        summary: subEntry.summary || parentEntry?.summary || "",
        author: subEntry.author || parentEntry?.author,
        coverUrl: coverProxyUrl,
        thumbnailUrl: coverProxyUrl,
        pdfProxyUrl,
        coverProxyUrl,
        acquisitionUrl: directAcquisition,
        webReaderUrl: webReader,
        format,
        hasPdf,
      };
    };

    // Função auxiliar recursiva para coletar sub-entries com PDF de sub-feeds
    const fetchSubFeedEntries = async (
      subUrl: string,
      depth = 0
    ): Promise<OpdsEntry[]> => {
      if (depth > 3 || subFeedFetchCount >= MAX_SUBFEEDS || visitedUrls.has(subUrl)) {
        return [];
      }
      visitedUrls.add(subUrl);
      subFeedFetchCount++;

      try {
        const res = await safeFetchKavita(subUrl, {
          headers: {
            Accept: "application/atom+xml, application/xml;q=0.9, */*;q=0.8",
          },
        });
        if (!res.ok) return [];

        const xml = await res.text();
        const feed = parseOpdsXml(xml, config.baseUrl);
        const collected: OpdsEntry[] = [];
        const seenChildIds = new Set<string>();

        for (const child of feed.entries) {
          if (seenChildIds.has(child.id)) {
            continue;
          }
          seenChildIds.add(child.id);

          if (child.acquisitionUrl) {
            collected.push(child);
          } else {
            const childSubUrls = child.subFeedUrls || (child.volumeUrl ? [child.volumeUrl] : (child.chapterUrl ? [child.chapterUrl] : []));
            if (childSubUrls.length > 0) {
              for (const nextSubUrl of childSubUrls) {
                const nested = await fetchSubFeedEntries(nextSubUrl, depth + 1);
                collected.push(...nested);
              }
            } else {
              collected.push(child);
            }
          }
        }

        return collected;
      } catch (err) {
        logger.warn({ err, subUrl }, "Falha ao resolver sub-feed no Kavita");
        return [];
      }
    };

    for (const entry of allEntries) {
      const rawSubUrls = [
        ...(entry.subFeedUrls || []),
        ...(entry.volumeUrl ? [entry.volumeUrl] : []),
        ...(entry.chapterUrl ? [entry.chapterUrl] : []),
      ];
      const subUrls = Array.from(new Set(rawSubUrls));

      // Se a entry tem links para sub-feeds (volumes, capítulos ou séries)
      if (subUrls.length > 0 && subFeedFetchCount < MAX_SUBFEEDS) {
        const foundSubEntries: OpdsEntry[] = [];
        const seenFeedEntryIds = new Set<string>();
        for (const sUrl of subUrls) {
          const subResults = await fetchSubFeedEntries(sUrl, 0);
          for (const subRes of subResults) {
            if (!seenFeedEntryIds.has(subRes.id)) {
              seenFeedEntryIds.add(subRes.id);
              foundSubEntries.push(subRes);
            }
          }
        }

        const subItemsWithPdf = foundSubEntries.filter((s) => Boolean(s.acquisitionUrl));

        if (subItemsWithPdf.length > 0) {
          for (const sub of subItemsWithPdf) {
            addBookItem(makeBookItem(sub, entry));
          }
          continue;
        } else if (foundSubEntries.length > 0 && !entry.acquisitionUrl) {
          // Se encontrou sub-entradas (mesmo sem link direto de acquisition)
          for (const sub of foundSubEntries) {
            addBookItem(makeBookItem(sub, entry));
          }
          continue;
        }
      }

      // Se possui acquisitionUrl direta ou não conseguiu expandir sub-feeds, adiciona a própria entry
      addBookItem(makeBookItem(entry));
    }

    return {
      configured: true,
      total: totalResults ?? items.length,
      items,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Erro ao consultar biblioteca Kavita via OPDS");
    return {
      configured: true,
      items: [],
      error: `Erro ao conectar com Kavita: ${errorMsg}`,
    };
  }
}
