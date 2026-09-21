import { describe, it, expect, vi, beforeEach } from "vitest";
import { PATCH, DELETE } from "../route";
import { NextRequest } from "next/server";

const { mockDb, mockRequireAuth } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
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
  },
}));

vi.mock("@/lib/auth/session", () => ({
  requireAuth: () => mockRequireAuth(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("PATCH & DELETE /api/library/documents/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("PATCH", () => {
    it("retorna 401 se não autenticado", async () => {
      mockRequireAuth.mockResolvedValue(null);

      const request = new NextRequest("http://localhost/api/library/documents/doc-1", {
        method: "PATCH",
        body: JSON.stringify({ title: "Updated Title" }),
      });

      const response = await PATCH(request, {
        params: Promise.resolve({ id: "doc-1" }),
      });
      expect(response.status).toBe(401);
    });

    it("retorna 404 se documento não existe", async () => {
      mockRequireAuth.mockResolvedValue({
        user: { id: "user-1", email: "user@test.com" },
      });

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const request = new NextRequest("http://localhost/api/library/documents/doc-1", {
        method: "PATCH",
        body: JSON.stringify({ title: "Updated Title" }),
      });

      const response = await PATCH(request, {
        params: Promise.resolve({ id: "doc-1" }),
      });
      expect(response.status).toBe(404);
    });

    it("atualiza com sucesso", async () => {
      mockRequireAuth.mockResolvedValue({
        user: { id: "user-1", email: "user@test.com" },
      });

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: "doc-1", title: "Old Title" }]),
          }),
        }),
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: "doc-1", title: "New Title" }]),
          }),
        }),
      });

      const request = new NextRequest("http://localhost/api/library/documents/doc-1", {
        method: "PATCH",
        body: JSON.stringify({ title: "New Title" }),
      });

      const response = await PATCH(request, {
        params: Promise.resolve({ id: "doc-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.title).toBe("New Title");
    });
  });

  describe("DELETE", () => {
    it("retorna 401 se não autenticado", async () => {
      mockRequireAuth.mockResolvedValue(null);

      const request = new NextRequest("http://localhost/api/library/documents/doc-1", {
        method: "DELETE",
      });

      const response = await DELETE(request, {
        params: Promise.resolve({ id: "doc-1" }),
      });
      expect(response.status).toBe(401);
    });

    it("exclui com sucesso documento existente", async () => {
      mockRequireAuth.mockResolvedValue({
        user: { id: "user-1", email: "user@test.com" },
      });

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: "doc-1" }]),
          }),
        }),
      });

      mockDb.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const request = new NextRequest("http://localhost/api/library/documents/doc-1", {
        method: "DELETE",
      });

      const response = await DELETE(request, {
        params: Promise.resolve({ id: "doc-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe("doc-1");
    });
  });
});
