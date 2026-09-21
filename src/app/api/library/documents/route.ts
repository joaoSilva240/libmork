import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { libraryDocuments } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { createLibraryDocumentSchema } from "@/lib/validators/library-document";
import { OFFICIAL_LIBRARY_DOCUMENTS } from "@/lib/library/seeds";
import { getKavitaCatalog } from "@/lib/kavita/service";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { logger } from "@/lib/logger";

/**
 * GET /api/library/documents
 * Consulta documentos da biblioteca com filtros opcionais:
 * - q: busca textual no título e descrição
 * - category: filtro por categoria
 * - provider: filtro por provedor
 * - campaignId: filtro por campanha
 * Retorna documentos do banco de dados combinados com sementes oficiais.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();
    const category = searchParams.get("category")?.trim();
    const provider = searchParams.get("provider")?.trim();
    const campaignId = searchParams.get("campaignId")?.trim();

    // Filtros para consulta no banco
    const conditions = [];

    if (q) {
      conditions.push(
        or(
          ilike(libraryDocuments.title, `%${q}%`),
          ilike(libraryDocuments.description, `%${q}%`)
        )
      );
    }

    if (category) {
      conditions.push(eq(libraryDocuments.category, category));
    }

    if (provider) {
      conditions.push(eq(libraryDocuments.provider, provider));
    }

    if (campaignId) {
      conditions.push(eq(libraryDocuments.campaignId, campaignId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const dbDocuments = await db
      .select()
      .from(libraryDocuments)
      .where(whereClause)
      .orderBy(desc(libraryDocuments.createdAt));

    // Filtra também sementes oficiais com base nos parâmetros
    const filteredSeeds = OFFICIAL_LIBRARY_DOCUMENTS.filter((doc) => {
      if (campaignId && doc.campaignId !== campaignId) {
        return false;
      }
      if (category && doc.category !== category) {
        return false;
      }
      if (provider && doc.provider !== provider) {
        return false;
      }
      if (q) {
        const query = q.toLowerCase();
        const matchesTitle = doc.title.toLowerCase().includes(query);
        const matchesDesc = doc.description
          ? doc.description.toLowerCase().includes(query)
          : false;
        if (!matchesTitle && !matchesDesc) {
          return false;
        }
      }
      return true;
    });

    // Combina oficiais + documentos cadastrados
    let combinedDocuments = [...filteredSeeds, ...dbDocuments];

    // Se o provedor for kavita ou all (e não filtrado por outra categoria incompatível)
    if (!provider || provider === "all" || provider === "kavita") {
      try {
        const kavitaRes = await getKavitaCatalog(q || undefined);
        if (kavitaRes.configured && kavitaRes.items.length > 0) {
          const kavitaDocs = kavitaRes.items.map((item) => {
            // Mapeamento: preservar webReaderUrl e só gerar externalUrl/pdfProxyUrl quando hasPdf
            const externalUrl = item.hasPdf && item.pdfProxyUrl ? item.pdfProxyUrl : "";
            const pdfProxyUrl = item.hasPdf ? (item.pdfProxyUrl ?? null) : null;
            const acquisitionUrl = item.hasPdf ? (item.acquisitionUrl ?? null) : null;

            return {
              id: `kavita-${item.id}`,
              title: item.title,
              description: item.summary,
              coverUrl: item.coverUrl ?? null,
              externalUrl,
              pdfProxyUrl,
              acquisitionUrl,
              webReaderUrl: item.webReaderUrl ?? null,
              provider: "kavita" as const,
              category: "livro-base" as const,
              tags: ["kavita", "opds", ...(item.format ? [item.format.toLowerCase()] : [])],
              isOfficial: false,
              isPublic: true,
              campaignId: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
          });

          // Filtra por categoria caso especificado
          const filteredKavita = category && category !== "all"
            ? kavitaDocs.filter((d) => d.category === category)
            : kavitaDocs;

          combinedDocuments = [...combinedDocuments, ...filteredKavita];
        }
      } catch (kavitaErr) {
        // Falha no Kavita não quebra os documentos existentes
        logger.warn({ err: kavitaErr }, "Kavita OPDS indisponível na listagem de documentos");
      }
    }

    const uniqueDocuments = Array.from(
      new Map(combinedDocuments.map((doc) => [doc.id, doc])).values()
    );

    return NextResponse.json({
      success: true,
      data: uniqueDocuments,
    });
  } catch (error) {
    logger.error({ err: error }, "Erro ao listar documentos da biblioteca");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/library/documents
 * Cria uma nova referência a documento na biblioteca.
 * Protegido por autenticação.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = createLibraryDocumentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Dados inválidos",
          errors: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const {
      title,
      description,
      coverUrl,
      externalUrl,
      provider,
      category,
      tags,
      isPublic,
      campaignId,
    } = validation.data;

    const [newDoc] = await db
      .insert(libraryDocuments)
      .values({
        title,
        description: description ?? null,
        coverUrl: coverUrl ?? null,
        externalUrl,
        provider,
        category,
        tags: tags ?? null,
        isOfficial: false,
        isPublic: isPublic ?? true,
        campaignId: campaignId ?? null,
      })
      .returning();

    return NextResponse.json(
      {
        success: true,
        data: newDoc,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error({ err: error }, "Erro ao criar documento da biblioteca");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
