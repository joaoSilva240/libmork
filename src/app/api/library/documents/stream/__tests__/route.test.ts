import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "../route";
import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/db/schema", () => ({
  libraryDocuments: {
    id: "library_documents.id",
    externalUrl: "library_documents.external_url",
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("GET /api/library/documents/stream", () => {
  const tempDir = path.resolve(os.tmpdir(), "libmork-stream-test");
  const testPdfPath = path.join(tempDir, "livro-teste.pdf");
  const originalEnv = process.env.LIBRARY_SMB_PATH;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LIBRARY_SMB_PATH = tempDir;

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    fs.writeFileSync(testPdfPath, "%PDF-1.4 Mock PDF Content For Testing");
  });

  afterEach(() => {
    process.env.LIBRARY_SMB_PATH = originalEnv;
    if (fs.existsSync(testPdfPath)) {
      fs.unlinkSync(testPdfPath);
    }
    if (fs.existsSync(tempDir)) {
      fs.rmdirSync(tempDir);
    }
  });

  it("retorna 400 se nenhum parâmetro for informado", async () => {
    const request = new NextRequest("http://localhost/api/library/documents/stream");
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it("retorna 503 se LIBRARY_SMB_PATH não estiver configurado", async () => {
    delete process.env.LIBRARY_SMB_PATH;
    const request = new NextRequest(
      "http://localhost/api/library/documents/stream?file=livro-teste.pdf"
    );
    const response = await GET(request);
    expect(response.status).toBe(503);
  });

  it("rejeita tentativa de path traversal", async () => {
    const request = new NextRequest(
      "http://localhost/api/library/documents/stream?file=../etc/passwd"
    );
    const response = await GET(request);
    expect(response.status).toBe(400);
  });

  it("rejeita streaming local para URLs web externas", async () => {
    const request = new NextRequest(
      "http://localhost/api/library/documents/stream?file=https://cdn.example.com/file.pdf"
    );
    const response = await GET(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain("URL web externa");
  });

  it("retorna 404 quando o arquivo não existe", async () => {
    const request = new NextRequest(
      "http://localhost/api/library/documents/stream?file=nao-existe.pdf"
    );
    const response = await GET(request);
    expect(response.status).toBe(404);
  });

  it("realiza streaming do PDF com cabeçalhos corretos", async () => {
    const request = new NextRequest(
      "http://localhost/api/library/documents/stream?file=livro-teste.pdf"
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Accept-Ranges")).toBe("bytes");
    expect(response.headers.get("Content-Disposition")).toContain("inline; filename=");
  });

  it("permite buscar arquivo por docId cadastrado no banco", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            {
              id: "doc-uuid",
              externalUrl: "livro-teste.pdf",
            },
          ]),
        }),
      }),
    });

    const request = new NextRequest(
      "http://localhost/api/library/documents/stream?docId=doc-uuid"
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
  });
});
