import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as postsGet, POST as postsPost } from "../posts/route";
import { POST as likePost } from "../posts/[id]/like/route";
import { POST as clonePost } from "../posts/[id]/clone/route";
import { POST as cloneComment } from "../comments/[commentId]/clone/route";
import { NextRequest } from "next/server";

const { mockDb, mockRequireAuth } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  mockRequireAuth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/db/schema", () => ({
  communityPosts: {
    id: "communityPosts.id",
    authorId: "communityPosts.authorId",
    title: "communityPosts.title",
    description: "communityPosts.description",
    contentType: "communityPosts.contentType",
    contentId: "communityPosts.contentId",
    tags: "communityPosts.tags",
    payload: "communityPosts.payload",
    clonesCount: "communityPosts.clonesCount",
    createdAt: "communityPosts.createdAt",
    updatedAt: "communityPosts.updatedAt",
  },
  communityLikes: {
    id: "communityLikes.id",
    postId: "communityLikes.postId",
    userId: "communityLikes.userId",
    createdAt: "communityLikes.createdAt",
  },
  communityPostVotes: {
    postId: "communityPostVotes.postId",
    userId: "communityPostVotes.userId",
    value: "communityPostVotes.value",
  },
   communityClones: {
     id: "communityClones.id",
     postId: "communityClones.postId",
     userId: "communityClones.userId",
   },
   communityComments: {
     id: "communityComments.id",
    postId: "communityComments.postId",
    userId: "communityComments.userId",
    content: "communityComments.content",
    commentType: "communityComments.commentType",
    attachmentContentType: "communityComments.attachmentContentType",
    attachmentTitle: "communityComments.attachmentTitle",
    attachmentPayload: "communityComments.attachmentPayload",
    createdAt: "communityComments.createdAt",
    updatedAt: "communityComments.updatedAt",
  },
  users: {
    id: "users.id",
    displayName: "users.displayName",
  },
  spells: { id: "spells.id" },
  items: { id: "items.id" },
  rpgClasses: { id: "rpgClasses.id" },
  npcs: { id: "npcs.id" },
  worlds: { id: "worlds.id" },
}));

vi.mock("@/lib/auth/session", () => ({
  requireAuth: () => mockRequireAuth(),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((field, value) => ({ field, value, op: "eq" })),
  and: vi.fn((...args) => ({ op: "and", args })),
  or: vi.fn((...args) => ({ op: "or", args })),
  ilike: vi.fn((field, value) => ({ field, value, op: "ilike" })),
  desc: vi.fn((field) => ({ field, op: "desc" })),
  asc: vi.fn((field) => ({ field, op: "asc" })),
  sql: vi.fn((strings, ...values) => ({ strings, values, op: "sql" })),
}));

describe("GET /api/community/posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna a lista de posts sem sessão (isLikedByMe sempre false)", async () => {
    mockRequireAuth.mockResolvedValue(null);

    const mockRows = [
      {
        post: {
          id: "post-1",
          authorId: "user-1",
          title: "Bola de Fogo",
          description: "Magia de fogo",
          contentType: "spell",
          contentId: "spell-1",
          tags: ["fogo"],
          payload: { name: "Bola de Fogo" },
          clonesCount: 5,
          createdAt: "2026-03-01T12:00:00Z",
          updatedAt: "2026-03-01T12:00:00Z",
        },
        author: { id: "user-1", displayName: "Mestre" },
        likesCount: 3,
        commentsCount: 1,
        isLikedByMe: false,
        upvotes: 2,
        downvotes: 1,
        score: 1,
        userVote: null,
      },
    ];

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              leftJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  groupBy: vi.fn().mockReturnValue({
                    orderBy: vi.fn().mockReturnValue({
                      limit: vi.fn().mockReturnValue({
                        offset: vi.fn().mockResolvedValue(mockRows),
                      }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    });

    const req = new NextRequest("http://localhost/api/community/posts?page=1&limit=12");
    const res = await postsGet(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(1);
    expect(data.data[0].title).toBe("Bola de Fogo");
    expect(data.data[0].likesCount).toBe(3);
    expect(data.data[0].isLikedByMe).toBe(false);
    expect(data.page).toBe(1);
    expect(data.limit).toBe(12);
  });

  it("aplica filtro por tipo de conteúdo (type=spell)", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-123", email: "test@libmork.com" },
    });

    const mockRows = [
      {
        post: {
          id: "post-spell",
          authorId: "user-1",
          title: "Magia Arcana",
          description: null,
          contentType: "spell",
          contentId: "spell-2",
          tags: [],
          payload: {},
          clonesCount: 0,
          createdAt: "2026-03-02T10:00:00Z",
          updatedAt: "2026-03-02T10:00:00Z",
        },
        author: { id: "user-1", displayName: "Arcano" },
        likesCount: 0,
        commentsCount: 0,
        isLikedByMe: false,
        upvotes: 0,
        downvotes: 0,
        score: 0,
        userVote: null,
      },
    ];

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              leftJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  groupBy: vi.fn().mockReturnValue({
                    orderBy: vi.fn().mockReturnValue({
                      limit: vi.fn().mockReturnValue({
                        offset: vi.fn().mockResolvedValue(mockRows),
                      }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    });

    const req = new NextRequest("http://localhost/api/community/posts?type=spell&limit=12");
    const res = await postsGet(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(1);
    expect(data.data[0].contentType).toBe("spell");
  });

  it("aplica filtro de busca (search=fogo)", async () => {
    mockRequireAuth.mockResolvedValue(null);

    const mockRows = [
      {
        post: {
          id: "post-fire",
          authorId: "user-2",
          title: "Bola de Fogo Ancestral",
          description: "Fogo devastador",
          contentType: "spell",
          contentId: null,
          tags: ["fogo", "arcano"],
          payload: {},
          clonesCount: 2,
          createdAt: "2026-03-03T08:00:00Z",
          updatedAt: "2026-03-03T08:00:00Z",
        },
        author: { id: "user-2", displayName: "Piromante" },
        likesCount: 5,
        commentsCount: 0,
        isLikedByMe: false,
      },
    ];

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              leftJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  groupBy: vi.fn().mockReturnValue({
                    orderBy: vi.fn().mockReturnValue({
                      limit: vi.fn().mockReturnValue({
                        offset: vi.fn().mockResolvedValue(mockRows),
                      }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    });

    const req = new NextRequest("http://localhost/api/community/posts?search=fogo&limit=12");
    const res = await postsGet(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data).toHaveLength(1);
    expect(data.data[0].title).toContain("Fogo");
  });

  it("aplica ordenação padrão top por score", async () => {
    mockRequireAuth.mockResolvedValue(null);

    const mockRows = [
      {
        post: {
          id: "post-1",
          authorId: "user-1",
          title: "Item Mais Votado",
          description: null,
          contentType: "item",
          contentId: null,
          tags: [],
          payload: {},
          clonesCount: 0,
          createdAt: "2026-03-01T12:00:00Z",
          updatedAt: "2026-03-01T12:00:00Z",
        },
        author: { id: "user-1", displayName: "Mestre" },
        likesCount: 1,
        commentsCount: 0,
        isLikedByMe: false,
        upvotes: 10,
        downvotes: 1,
        score: 9,
        userVote: null,
      },
    ];

    const mockOrderBy = vi.fn().mockReturnValue({
      limit: vi.fn().mockReturnValue({
        offset: vi.fn().mockResolvedValue(mockRows),
      }),
    });

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              leftJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  groupBy: vi.fn().mockReturnValue({
                    orderBy: mockOrderBy,
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    });

    const req = new NextRequest("http://localhost/api/community/posts?sort=top");
    const res = await postsGet(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data[0].score).toBe(9);
    expect(mockOrderBy).toHaveBeenCalled();
  });
});

describe("POST /api/community/posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna 401 quando não autenticado", async () => {
    mockRequireAuth.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/community/posts", {
      method: "POST",
      body: JSON.stringify({
        title: "Test",
        contentType: "spell",
        payload: {},
      }),
    });

    const res = await postsPost(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Não autenticado");
  });

  it("valida e cria um post com dados corretos via Zod", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-123", email: "test@libmork.com" },
    });

    const validUuid = "550e8400-e29b-41d4-a716-446655440000";
    const mockPost = {
      id: "post-new",
      authorId: "user-123",
      title: "Nova Magia",
      description: "Descrição da magia",
      contentType: "spell",
      contentId: validUuid,
      tags: ["arcano", "ofensivo"],
      payload: { name: "Nova Magia", level: 3 },
      clonesCount: 0,
      createdAt: "2026-03-04T10:00:00Z",
      updatedAt: "2026-03-04T10:00:00Z",
    };

    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockPost]),
      }),
    });

    const req = new NextRequest("http://localhost/api/community/posts", {
      method: "POST",
      body: JSON.stringify({
        title: "Nova Magia",
        description: "Descrição da magia",
        contentType: "spell",
        contentId: validUuid,
        tags: ["arcano", "ofensivo"],
        payload: { name: "Nova Magia", level: 3 },
      }),
    });

    const res = await postsPost(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.id).toBe("post-new");
    expect(data.title).toBe("Nova Magia");
    expect(data.authorId).toBe("user-123");
  });

  it("retorna 400 quando dados inválidos (validação Zod)", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-123", email: "test@libmork.com" },
    });

    const req = new NextRequest("http://localhost/api/community/posts", {
      method: "POST",
      body: JSON.stringify({
        title: "",
        contentType: "invalid-type",
        payload: {},
      }),
    });

    const res = await postsPost(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Dados inválidos");
    expect(data.details).toBeDefined();
  });
});

describe("POST /api/community/posts/[id]/like", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna 401 quando não autenticado", async () => {
    mockRequireAuth.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/community/posts/post-1/like", {
      method: "POST",
    });
    const params = Promise.resolve({ id: "post-1" });

    const res = await likePost(req, { params });
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Não autenticado");
  });

  it("retorna 404 quando o post não existe", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-123", email: "test@libmork.com" },
    });

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const req = new NextRequest("http://localhost/api/community/posts/post-invalid/like", {
      method: "POST",
    });
    const params = Promise.resolve({ id: "post-invalid" });

    const res = await likePost(req, { params });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Post não encontrado");
  });

  it("adiciona like quando usuário ainda não curtiu", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-123", email: "test@libmork.com" },
    });

    // Mock: post existe
    mockDb.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              { id: "post-1", title: "Test Post", clonesCount: 0 },
            ]),
          }),
        }),
      })
      // Mock: like não existe
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      })
      // Mock: contagem de likes
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 1 }]),
        }),
      });

    mockDb.insert.mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });

    const req = new NextRequest("http://localhost/api/community/posts/post-1/like", {
      method: "POST",
    });
    const params = Promise.resolve({ id: "post-1" });

    const res = await likePost(req, { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.isLiked).toBe(true);
    expect(data.likesCount).toBe(1);
  });

  it("remove like quando usuário já curtiu (alternância de like)", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-123", email: "test@libmork.com" },
    });

    // Mock: post existe
    mockDb.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              { id: "post-1", title: "Test Post", clonesCount: 0 },
            ]),
          }),
        }),
      })
      // Mock: like existe
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              { id: "like-1", postId: "post-1", userId: "user-123" },
            ]),
          }),
        }),
      })
      // Mock: contagem de likes após remover
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      });

    mockDb.delete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    const req = new NextRequest("http://localhost/api/community/posts/post-1/like", {
      method: "POST",
    });
    const params = Promise.resolve({ id: "post-1" });

    const res = await likePost(req, { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.isLiked).toBe(false);
    expect(data.likesCount).toBe(0);
  });
});

describe("POST /api/community/posts/[id]/clone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna 401 quando não autenticado", async () => {
    mockRequireAuth.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/community/posts/post-1/clone", {
      method: "POST",
    });
    const params = Promise.resolve({ id: "post-1" });

    const res = await clonePost(req, { params });
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Não autenticado");
  });

  it("retorna 404 quando o post não existe", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-123", email: "test@libmork.com" },
    });

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const req = new NextRequest("http://localhost/api/community/posts/post-invalid/clone", {
      method: "POST",
    });
    const params = Promise.resolve({ id: "post-invalid" });

    const res = await clonePost(req, { params });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Post não encontrado");
  });

  it("clona um post do tipo spell e incrementa clonesCount", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-123", email: "test@libmork.com", displayName: "Testador" },
    });

    const mockPost = {
      id: "post-1",
      authorId: "user-1",
      title: "Bola de Fogo",
      contentType: "spell",
      payload: { name: "Bola de Fogo", level: 3, school: "Evocação" },
      clonesCount: 5,
    };

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockPost]),
        }),
      }),
    });

    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "spell-cloned-123" }]),
      }),
    });

    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    const req = new NextRequest("http://localhost/api/community/posts/post-1/clone", {
      method: "POST",
    });
    const params = Promise.resolve({ id: "post-1" });

    const res = await clonePost(req, { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.newEntityId).toBe("spell-cloned-123");
  });

  it("retorna 400 ao tentar clonar uma campanha (não suportado)", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-123", email: "test@libmork.com" },
    });

    const mockPost = {
      id: "post-campaign",
      authorId: "user-1",
      title: "Campanha Épica",
      contentType: "campaign",
      payload: {},
      clonesCount: 0,
    };

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockPost]),
        }),
      }),
    });

    const req = new NextRequest("http://localhost/api/community/posts/post-campaign/clone", {
      method: "POST",
    });
    const params = Promise.resolve({ id: "post-campaign" });

    const res = await clonePost(req, { params });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Clonagem de campanhas não é suportada ainda");
  });
});

describe("POST /api/community/comments/[commentId]/clone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna 401 quando não autenticado", async () => {
    mockRequireAuth.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/community/comments/comment-1/clone", {
      method: "POST",
    });
    const params = Promise.resolve({ commentId: "comment-1" });

    const res = await cloneComment(req, { params });
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Não autenticado");
  });

  it("retorna 404 quando o comentário não existe", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-123", email: "test@libmork.com" },
    });

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const req = new NextRequest("http://localhost/api/community/comments/comment-invalid/clone", {
      method: "POST",
    });
    const params = Promise.resolve({ commentId: "comment-invalid" });

    const res = await cloneComment(req, { params });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Comentário não encontrado");
  });

  it("retorna 400 quando comentário não é do tipo attachment", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-123", email: "test@libmork.com" },
    });

    const mockComment = {
      id: "comment-1",
      postId: "post-1",
      commentType: "text",
      content: "Comentário normal",
    };

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([mockComment]),
        }),
      }),
    });

    const req = new NextRequest("http://localhost/api/community/comments/comment-1/clone", {
      method: "POST",
    });
    const params = Promise.resolve({ commentId: "comment-1" });

    const res = await cloneComment(req, { params });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Comentário não é uma versão anexada");
  });

  it("clona um comentário do tipo attachment com sucesso", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-123", email: "test@libmork.com", displayName: "Testador" },
    });

    const mockComment = {
      id: "comment-attached",
      postId: "post-1",
      commentType: "attachment",
      attachmentContentType: "spell",
      attachmentTitle: "Bola de Fogo Modificada",
      attachmentPayload: { name: "Bola de Fogo Modificada", level: 4 },
    };

    mockDb.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockComment]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ clonesCount: 10 }]),
          }),
        }),
      });

    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "spell-from-comment" }]),
      }),
    });

    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    const req = new NextRequest("http://localhost/api/community/comments/comment-attached/clone", {
      method: "POST",
    });
    const params = Promise.resolve({ commentId: "comment-attached" });

    const res = await cloneComment(req, { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.newEntityId).toBe("spell-from-comment");
  });
});
