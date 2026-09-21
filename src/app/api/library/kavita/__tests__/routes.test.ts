import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as catalogRoute } from "../catalog/route";
import { GET as proxyRoute } from "../proxy/route";

vi.mock("@/lib/auth/session", () => ({
  requireAuth: vi.fn(),
}));

import { requireAuth } from "@/lib/auth/session";

describe("Kavita API Routes", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("GET /api/library/kavita/catalog", () => {
    it("rejeita requisições não autenticadas com 401", async () => {
      vi.mocked(requireAuth).mockResolvedValueOnce(null as any);

      const req = new NextRequest("http://localhost/api/library/kavita/catalog");
      const res = await catalogRoute(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error).toBe("Não autenticado");
    });

    it("retorna catálogo com sucesso para usuário autenticado", async () => {
      vi.mocked(requireAuth).mockResolvedValueOnce({
        user: { id: "user-1", email: "master@teste.com" },
      } as any);

      process.env.KAVITA_OPDS_KEY = "test-key";
      process.env.KAVITA_URL = "http://100.122.171.83:5150";

      const mockXml = `<?xml version="1.0" encoding="utf-8"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <entry>
          <id>1</id>
          <title>Livro Kavita 1</title>
          <link rel="http://opds-spec.org/acquisition" href="/api/opds/test-key/download.pdf" type="application/pdf" />
        </entry>
      </feed>`;

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockXml,
        headers: new Headers(),
      } as any);

      const req = new NextRequest("http://localhost/api/library/kavita/catalog");
      const res = await catalogRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.items.length).toBe(1);
      expect(json.data.items[0].title).toBe("Livro Kavita 1");
    });
  });

  describe("GET /api/library/kavita/proxy", () => {
    it("retorna 400 com erro específico quando parâmetro 'url' está ausente", async () => {
      vi.mocked(requireAuth).mockResolvedValueOnce({
        user: { id: "user-1" },
      } as any);

      const req = new NextRequest("http://localhost/api/library/kavita/proxy");
      const res = await proxyRoute(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toBe("Parâmetro 'url' é obrigatório");
    });

    it("rejeita requisição se usuário não estiver autenticado", async () => {
      vi.mocked(requireAuth).mockResolvedValueOnce(null as any);

      const req = new NextRequest("http://localhost/api/library/kavita/proxy?url=http://100.122.171.83:5150/test.pdf");
      const res = await proxyRoute(req);

      expect(res.status).toBe(401);
    });

    it("bloqueia destino correspondente a leitor web para type=pdf", async () => {
      vi.mocked(requireAuth).mockResolvedValueOnce({
        user: { id: "user-1" },
      } as any);

      process.env.KAVITA_OPDS_KEY = "key";
      process.env.KAVITA_URL = "http://100.122.171.83:5150";

      const req = new NextRequest(
        "http://localhost/api/library/kavita/proxy?url=/library/4/series/56/pdf/358?incognitoMode=false&type=pdf"
      );
      const res = await proxyRoute(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toContain("leitor web");
    });

    it("rejeita resposta com Content-Type text/html quando requisitado type=pdf (422)", async () => {
      vi.mocked(requireAuth).mockResolvedValueOnce({
        user: { id: "user-1" },
      } as any);

      process.env.KAVITA_OPDS_KEY = "key";
      process.env.KAVITA_URL = "http://100.122.171.83:5150";

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          "content-type": "text/html; charset=utf-8",
        }),
        body: new ReadableStream({
          start(c) {
            c.enqueue(new TextEncoder().encode("<html>Kavita Web Reader</html>"));
            c.close();
          },
        }),
      } as any);

      const req = new NextRequest(
        "http://localhost/api/library/kavita/proxy?url=http://100.122.171.83:5150/api/opds/key/download.pdf&type=pdf"
      );
      const res = await proxyRoute(req);
      const json = await res.json();

      expect(res.status).toBe(422);
      expect(json.success).toBe(false);
      expect(json.error).toContain("HTML em vez de um arquivo PDF");
    });

    it("bloqueia URLs externas ou maliciosas que divergem do host Kavita configurado (SSRF)", async () => {
      vi.mocked(requireAuth).mockResolvedValueOnce({
        user: { id: "user-1" },
      } as any);

      process.env.KAVITA_OPDS_KEY = "key";
      process.env.KAVITA_URL = "http://100.122.171.83:5150";

      const req = new NextRequest("http://localhost/api/library/kavita/proxy?url=http://169.254.169.254/secret");
      const res = await proxyRoute(req);

      expect(res.status).toBe(403);
    });

    it("faz proxy de PDF e repassa Range header e Content-Disposition inline", async () => {
      vi.mocked(requireAuth).mockResolvedValueOnce({
        user: { id: "user-1" },
      } as any);

      process.env.KAVITA_OPDS_KEY = "key";
      process.env.KAVITA_URL = "http://100.122.171.83:5150";

      const fakePdfStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("%PDF-1.4 test"));
          controller.close();
        },
      });

      const responseHeaders = new Headers({
        "Content-Type": "application/pdf",
        "Content-Length": "14",
        "Accept-Ranges": "bytes",
      });

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: fakePdfStream,
        headers: responseHeaders,
      } as any);

      const req = new NextRequest(
        "http://localhost/api/library/kavita/proxy?url=http://100.122.171.83:5150/api/opds/key/download.pdf&type=pdf",
        {
          headers: { Range: "bytes=0-10" },
        }
      );

      const res = await proxyRoute(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Disposition")).toBe("inline");
      expect(res.headers.get("Content-Type")).toBe("application/pdf");
      expect(res.headers.get("Accept-Ranges")).toBe("bytes");
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    });

    it("lida com URLs com porta implícita ou normalização de baseUrl", async () => {
      vi.mocked(requireAuth).mockResolvedValueOnce({
        user: { id: "user-1" },
      } as any);

      process.env.KAVITA_OPDS_KEY = "key";
      process.env.KAVITA_URL = "100.122.171.83:5150/";

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: new ReadableStream(),
        headers: new Headers({ "Content-Type": "application/pdf" }),
      } as any);

      const req = new NextRequest(
        "http://localhost/api/library/kavita/proxy?url=/api/opds/key/download.pdf&type=pdf"
      );

      const res = await proxyRoute(req);
      expect(res.status).toBe(200);
    });

    it("trata erro 400 Bad Request do Kavita com mensagem clara e status 400", async () => {
      vi.mocked(requireAuth).mockResolvedValueOnce({
        user: { id: "user-1" },
      } as any);

      process.env.KAVITA_OPDS_KEY = "key";
      process.env.KAVITA_URL = "http://100.122.171.83:5150";

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
      } as any);

      const req = new NextRequest(
        "http://localhost/api/library/kavita/proxy?url=http://100.122.171.83:5150/api/opds/key/invalid.pdf&type=pdf"
      );

      const res = await proxyRoute(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toContain("400 Bad Request");
    });
  });
});
