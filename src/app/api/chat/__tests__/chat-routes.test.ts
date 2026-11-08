import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as getGroups } from "../groups/route";
import { GET as getMessages, POST as postMessage } from "../groups/[groupId]/messages/route";
import { POST as markRead } from "../groups/[groupId]/read/route";
import { POST as votePollRoute } from "../polls/[pollId]/vote/route";
import { PATCH as closePollRoute } from "../polls/[pollId]/close/route";

import type { users, sessions } from "@/lib/db/schema";

vi.mock("@/lib/auth/session", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/server/chat-service", () => ({
  listUserChatGroups: vi.fn(),
  getGroupMessages: vi.fn(),
  postChatMessage: vi.fn(),
  votePoll: vi.fn(),
  closePoll: vi.fn(),
  markGroupAsRead: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

const { requireAuth } = await import("@/lib/auth/session");
const {
  listUserChatGroups,
  getGroupMessages,
  postChatMessage,
  votePoll,
  closePoll,
  markGroupAsRead,
} = await import("@/lib/server/chat-service");

type AuthSession = {
  user: typeof users.$inferSelect;
  session: typeof sessions.$inferSelect;
};

const mockAuth: AuthSession = {
  user: {
    id: "user-1",
    email: "user@example.com",
    displayName: "User One",
  } as unknown as typeof users.$inferSelect,
  session: {} as unknown as typeof sessions.$inferSelect,
};

describe("Chat & Polls API Routes (Issue #62)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/chat/groups", () => {
    it("retorna 401 para usuário não autenticado", async () => {
      vi.mocked(requireAuth).mockResolvedValue(null);
      const res = await getGroups();
      expect(res.status).toBe(401);
    });

    it("retorna lista de grupos com sucesso", async () => {
      vi.mocked(requireAuth).mockResolvedValue(mockAuth);
      vi.mocked(listUserChatGroups).mockResolvedValue([
        {
          id: "g-1",
          campaignId: "c-1",
          type: "campaign",
          name: "Campanha A",
          avatarUrl: null,
          role: "admin",
          permissions: { canRead: true, canWrite: true, canShare: true },
          unreadCount: 0,
          lastMessage: null,
          membersCount: 3,
          updatedAt: new Date().toISOString(),
        },
      ]);

      const res = await getGroups();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(1);
    });
  });

  describe("GET /api/chat/groups/:groupId/messages", () => {
    it("retorna mensagens do grupo", async () => {
      vi.mocked(requireAuth).mockResolvedValue(mockAuth);
      vi.mocked(getGroupMessages).mockResolvedValue([
        {
          id: "m-1",
          groupId: "g-1",
          senderId: "user-1",
          senderName: "João",
          senderAvatar: null,
          isMaster: true,
          content: "Olá pessoal!",
          type: "text",
          createdAt: new Date().toISOString(),
        },
      ]);

      const req = new NextRequest("http://localhost/api/chat/groups/g-1/messages");
      const res = await getMessages(req, { params: Promise.resolve({ groupId: "g-1" }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toHaveLength(1);
    });

    it("retorna 403 se o usuário não for membro", async () => {
      vi.mocked(requireAuth).mockResolvedValue(mockAuth);
      vi.mocked(getGroupMessages).mockRejectedValue(new Error("Você não é membro deste grupo"));

      const req = new NextRequest("http://localhost/api/chat/groups/g-1/messages");
      const res = await getMessages(req, { params: Promise.resolve({ groupId: "g-1" }) });
      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/chat/groups/:groupId/messages", () => {
    it("cria mensagem de texto com sucesso", async () => {
      vi.mocked(requireAuth).mockResolvedValue(mockAuth);
      vi.mocked(postChatMessage).mockResolvedValue({
        id: "m-2",
        groupId: "g-1",
        senderId: "user-1",
        senderName: "João",
        senderAvatar: null,
        isMaster: true,
        content: "Nova mensagem",
        type: "text",
        createdAt: new Date().toISOString(),
      });

      const req = new NextRequest("http://localhost/api/chat/groups/g-1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "Nova mensagem" }),
      });

      const res = await postMessage(req, { params: Promise.resolve({ groupId: "g-1" }) });
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.content).toBe("Nova mensagem");
    });

    it("retorna 400 para corpo inválido", async () => {
      vi.mocked(requireAuth).mockResolvedValue(mockAuth);

      const req = new NextRequest("http://localhost/api/chat/groups/g-1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "" }),
      });

      const res = await postMessage(req, { params: Promise.resolve({ groupId: "g-1" }) });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/chat/groups/:groupId/read", () => {
    it("marca mensagens como lidas", async () => {
      vi.mocked(requireAuth).mockResolvedValue(mockAuth);
      const req = new NextRequest("http://localhost/api/chat/groups/g-1/read", {
        method: "POST",
      });
      const res = await markRead(req, { params: Promise.resolve({ groupId: "g-1" }) });
      expect(res.status).toBe(200);
      expect(markGroupAsRead).toHaveBeenCalledWith("g-1", "user-1");
    });
  });

  describe("POST /api/chat/polls/:pollId/vote", () => {
    it("computa o voto na enquete", async () => {
      vi.mocked(requireAuth).mockResolvedValue(mockAuth);
      vi.mocked(votePoll).mockResolvedValue({
        id: "poll-1",
        title: "Dia da sessão",
        isMultipleChoice: false,
        status: "open",
        closedAt: null,
        createdAt: new Date().toISOString(),
        createdById: "user-1",
        createdByName: "Mestre",
        totalVotes: 1,
        options: [],
        userVotedOptionIds: ["550e8400-e29b-41d4-a716-446655440000"],
      });

      const req = new NextRequest("http://localhost/api/chat/polls/poll-1/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          optionIds: ["550e8400-e29b-41d4-a716-446655440000"],
        }),
      });

      const res = await votePollRoute(req, { params: Promise.resolve({ pollId: "poll-1" }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.id).toBe("poll-1");
    });
  });

  describe("PATCH /api/chat/polls/:pollId/close", () => {
    it("encerra a enquete", async () => {
      vi.mocked(requireAuth).mockResolvedValue(mockAuth);
      vi.mocked(closePoll).mockResolvedValue({
        id: "poll-1",
        title: "Dia da sessão",
        isMultipleChoice: false,
        status: "closed",
        closedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        createdById: "user-1",
        createdByName: "Mestre",
        totalVotes: 3,
        options: [],
        userVotedOptionIds: [],
      });

      const req = new NextRequest("http://localhost/api/chat/polls/poll-1/close", {
        method: "PATCH",
      });

      const res = await closePollRoute(req, { params: Promise.resolve({ pollId: "poll-1" }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.status).toBe("closed");
    });
  });
});
