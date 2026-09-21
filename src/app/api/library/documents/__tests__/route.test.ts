import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "../route";
import { NextRequest } from "next/server";

const { mockDb, mockRequireAuth } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn(),
    insert: vi.fn(),
  },
  mockRequireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/db/schema", () => ({
  libraryDocuments: {
    id: "library_documents.id",
    title: "library_documents.title",
    description: "library_documents.description",
    coverUrl: "library_documents.cover_url",
    externalUrl: "library_documents.external_url",
    provider: "library_documents.provider",
    category: "library_documents.category",
    tags: "library_documents.tags",
    isOfficial: "library_documents.is_official",
    isPublic: "library_documents.is_public",
    campaignId: "library_documents.campaign_id",
    createdAt: "library_documents.created_at",
    updatedAt: "library_documents.updated_at",
  },
}));

vi.mock("@/lib/auth/session", () => ({
  requireAuth: () => mockRequireAuth(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@/lib/kavita/service", () => ({
  getKavitaCatalog: vi.fn().mockResolvedValue({ configured: false, items: [] }),
}));

import { getKavitaCatalog } from "@/lib/kavita/service";

describe("GET /api/library/documents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna lista de documentos combinada com oficiais", async () => {
    const mockDbResult = [
      {
        id: "doc-1",
        title: "Homebrew Monstro",
        description: "Regras customizadas",
        externalUrl: "smb://share/monstros.pdf",
        provider: "smb",
        category: "suplemento",
        tags: ["monstros"],
        isOfficial: false,
        isPublic: true,
        campaignId: null,
      },
    ];

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(mockDbResult),
        }),
      }),
    });

    const request = new NextRequest("http://localhost/api/library/documents");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    // Deve conter oficiais + mockDbResult
    expect(body.data.some((d: any) => d.isOfficial === true)).toBe(true);
    expect(body.data.some((d: any) => d.id === "doc-1")).toBe(true);
  });

  it("filtra por categoria e q", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const request = new NextRequest(
      "http://localhost/api/library/documents?category=livro-base&q=Regras"
    );
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.every((d: any) => d.category === "livro-base")).toBe(true);
  });

  it("preserva webReaderUrl e só gera externalUrl/pdfProxyUrl quando hasPdf for true", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    vi.mocked(getKavitaCatalog).mockResolvedValueOnce({
      configured: true,
      items: [
        {
          id: "series-56",
          title: "Livro Apenas Web",
          summary: "Sem PDF direto",
          hasPdf: false,
          webReaderUrl: "http://100.122.171.83:5150/library/4/series/56/pdf/358?incognitoMode=false",
        },
        {
          id: "series-57",
          title: "Livro Com PDF",
          summary: "Com PDF direto",
          hasPdf: true,
          pdfProxyUrl: "/api/library/kavita/proxy?url=test.pdf&type=pdf",
          acquisitionUrl: "http://100.122.171.83:5150/test.pdf",
          webReaderUrl: "http://100.122.171.83:5150/web",
        },
      ],
    });

    const request = new NextRequest("http://localhost/api/library/documents?provider=kavita");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    const webOnly = body.data.find((d: any) => d.id === "kavita-series-56");
    expect(webOnly).toBeDefined();
    expect(webOnly.externalUrl).toBe("");
    expect(webOnly.pdfProxyUrl).toBeNull();
    expect(webOnly.webReaderUrl).toBe("http://100.122.171.83:5150/library/4/series/56/pdf/358?incognitoMode=false");

    const withPdf = body.data.find((d: any) => d.id === "kavita-series-57");
    expect(withPdf).toBeDefined();
    expect(withPdf.externalUrl).toBe("/api/library/kavita/proxy?url=test.pdf&type=pdf");
    expect(withPdf.pdfProxyUrl).toBe("/api/library/kavita/proxy?url=test.pdf&type=pdf");
    expect(withPdf.webReaderUrl).toBe("http://100.122.171.83:5150/web");
  });
});

describe("POST /api/library/documents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejeita requisição quando não autenticado", async () => {
    mockRequireAuth.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/library/documents", {
      method: "POST",
      body: JSON.stringify({
        title: "Livro Teste",
        externalUrl: "smb://livro.pdf",
        provider: "smb",
        category: "livro-base",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("salva metadados do documento no banco quando autenticado e válido", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-1", email: "user@test.com", role: "master" },
    });

    const createdRecord = {
      id: "new-doc-id",
      title: "Livro dos Monstros",
      description: "Desc",
      coverUrl: null,
      externalUrl: "smb://monstros.pdf",
      provider: "smb",
      category: "suplemento",
      tags: ["monstros"],
      isOfficial: false,
      isPublic: true,
      campaignId: null,
    };

    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([createdRecord]),
      }),
    });

    const request = new NextRequest("http://localhost/api/library/documents", {
      method: "POST",
      body: JSON.stringify({
        title: "Livro dos Monstros",
        description: "Desc",
        externalUrl: "smb://monstros.pdf",
        provider: "smb",
        category: "suplemento",
        tags: ["monstros"],
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe("new-doc-id");
  });

  it("rejeita body inválido", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-1", email: "user@test.com", role: "master" },
    });

    const request = new NextRequest("http://localhost/api/library/documents", {
      method: "POST",
      body: JSON.stringify({
        title: "",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
  });
});
