import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PgDialect } from "drizzle-orm/pg-core";
import { GET } from "../route";

const mockSelect = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    select: (...args: any[]) => mockSelect(...args),
  },
}));

vi.mock("@/lib/auth/session", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

const { requireAuth } = await import("@/lib/auth/session");

describe("/api/content/[type]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "u1" } } as any);
  });

  function mockQueryChain(rows: unknown[]) {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue(rows),
    };
    mockSelect.mockReturnValue(chain);
    return chain;
  }

  it("lista conteúdo global sem filtro", async () => {
    mockQueryChain([{ id: "1", name: "Espada" }]);

    const request = new NextRequest("http://localhost/api/content/items");
    const response = await GET(request, { params: Promise.resolve({ type: "items" }) });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.data).toHaveLength(1);
  });

  it("filtra por ruleSystem incluindo genéricos no Libmork d20", async () => {
    const chain = mockQueryChain([]);

    const request = new NextRequest("http://localhost/api/content/items?ruleSystem=libmork");
    const response = await GET(request, { params: Promise.resolve({ type: "items" }) });

    expect(response.status).toBe(200);
    expect(chain.where).toHaveBeenCalled();
    const rendered = new PgDialect().sqlToQuery(chain.where.mock.calls[0][0]);
    expect(rendered.params).toContain("generic");
    expect(rendered.params).toContain("libmork");
  });

  it("filtra Fallout 2d20 SEM incluir o conteúdo genérico", async () => {
    const chain = mockQueryChain([]);

    const request = new NextRequest(
      "http://localhost/api/content/items?ruleSystem=fallout_2d20",
    );
    const response = await GET(request, { params: Promise.resolve({ type: "items" }) });

    expect(response.status).toBe(200);
    expect(chain.where).toHaveBeenCalled();
    const rendered = new PgDialect().sqlToQuery(chain.where.mock.calls[0][0]);
    expect(rendered.params).toContain("fallout_2d20");
    expect(rendered.params).not.toContain("generic");
  });

  it("rejeita ruleSystem inválido com 400", async () => {
    const request = new NextRequest("http://localhost/api/content/items?ruleSystem=warhammer");
    const response = await GET(request, { params: Promise.resolve({ type: "items" }) });

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Sistema de regras inválido");
  });
});
