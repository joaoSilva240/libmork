import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as discordAuthGet } from "../route";
import { GET as discordCallbackGet } from "../callback/route";
import { createDiscordState } from "@/lib/auth/discord";

vi.mock("@/lib/db", () => {
  return {
    db: {
      select: vi.fn(),
      insert: vi.fn(),
    },
  };
});

vi.mock("@/lib/auth/session", () => ({
  createSession: vi.fn().mockResolvedValue("test-token"),
  getSession: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("Discord OAuth Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_SECRET = "test-secret-at-least-32-chars-long-security";
    process.env.DISCORD_CLIENT_ID = "test-client-id";
    process.env.DISCORD_CLIENT_SECRET = "test-client-secret";
    process.env.DISCORD_CALLBACK_URL = "http://localhost:3000/api/auth/discord/callback";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  });

  describe("GET /api/auth/discord", () => {
    it("returns 500 when DISCORD_CLIENT_ID is missing", async () => {
      delete process.env.DISCORD_CLIENT_ID;
      const req = new NextRequest("http://localhost:3000/api/auth/discord");
      const res = await discordAuthGet(req);

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe("discord_not_configured");
    });

    it("redirects to Discord authorization URL with correct parameters", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/discord?redirect=/player");
      const res = await discordAuthGet(req);

      expect(res.status).toBe(302);
      const location = res.headers.get("Location");
      expect(location).toBeTruthy();

      const targetUrl = new URL(location!);
      expect(targetUrl.hostname).toBe("discord.com");
      expect(targetUrl.pathname).toBe("/api/oauth2/authorize");
      expect(targetUrl.searchParams.get("client_id")).toBe("test-client-id");
      expect(targetUrl.searchParams.get("scope")).toBe("identify email");
      expect(targetUrl.searchParams.get("response_type")).toBe("code");
      expect(targetUrl.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/auth/discord/callback");
      expect(targetUrl.searchParams.get("state")).toBeTruthy();
    });
  });

  describe("GET /api/auth/discord/callback", () => {
    it("redirects to /login?error=oauth_access_denied if Discord returned error", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/discord/callback?error=access_denied");
      const res = await discordCallbackGet(req);

      expect(res.status).toBe(303);
      expect(res.headers.get("Location")).toContain("/login?error=oauth_access_denied");
    });

    it("redirects to /login?error=oauth_invalid_request if code is missing", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/discord/callback?state=xyz");
      const res = await discordCallbackGet(req);

      expect(res.status).toBe(303);
      expect(res.headers.get("Location")).toContain("/login?error=oauth_invalid_request");
    });

    it("redirects to /login?error=oauth_state_invalid if state signature or format is invalid", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/discord/callback?code=mock_code&state=invalid.state");
      const res = await discordCallbackGet(req);

      expect(res.status).toBe(303);
      expect(res.headers.get("Location")).toContain("/login?error=oauth_state_invalid");
    });

    it("redirects with account_linking_required when email matches existing local user without session", async () => {
      const state = createDiscordState("/player");
      const { db } = await import("@/lib/db");

      // Mock Discord token endpoint
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("/oauth2/token")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ access_token: "test_token", token_type: "Bearer" }),
          });
        }
        if (url.includes("/users/@me")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              id: "discord_uid_123",
              username: "testuser",
              email: "existing@example.com",
              verified: true,
            }),
          });
        }
        return originalFetch(url);
      });

      // No existing oauth account, but user with email exists
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([]), // no existing oauthAccount
          }),
        }),
      } as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([{ id: "existing-user-id", email: "existing@example.com" }]), // user exists
          }),
        }),
      } as any);

      const req = new NextRequest(`http://localhost:3000/api/auth/discord/callback?code=valid_code&state=${state}`);
      const res = await discordCallbackGet(req);

      expect(res.status).toBe(303);
      expect(res.headers.get("Location")).toContain("/login?error=account_linking_required");

      global.fetch = originalFetch;
    });

    it("creates user and session successfully for new verified Discord user", async () => {
      const state = createDiscordState("/player");
      const { db } = await import("@/lib/db");
      const { createSession } = await import("@/lib/auth/session");

      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("/oauth2/token")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ access_token: "test_token", token_type: "Bearer" }),
          });
        }
        if (url.includes("/users/@me")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              id: "discord_uid_new",
              username: "newuser",
              email: "new@example.com",
              verified: true,
            }),
          });
        }
        return originalFetch(url);
      });

      // No oauth account, no user with this email
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([]),
          }),
        }),
      } as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([]),
          }),
        }),
      } as any);

      vi.mocked(db.insert).mockReturnValueOnce({
        values: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValueOnce([{ id: "new-user-id", email: "new@example.com", role: "player" }]),
        }),
      } as any).mockReturnValueOnce({
        values: vi.fn().mockResolvedValueOnce({}),
      } as any);

      const req = new NextRequest(`http://localhost:3000/api/auth/discord/callback?code=valid_code&state=${state}`);
      const res = await discordCallbackGet(req);

      expect(res.status).toBe(303);
      expect(res.headers.get("Location")).toBe("http://localhost:3000/player");
      expect(createSession).toHaveBeenCalledWith("new-user-id", expect.anything(), expect.anything());

      global.fetch = originalFetch;
    });

    it("logs in directly if oauthAccount already exists", async () => {
      const state = createDiscordState("/master");
      const { db } = await import("@/lib/db");
      const { createSession } = await import("@/lib/auth/session");

      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("/oauth2/token")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ access_token: "test_token", token_type: "Bearer" }),
          });
        }
        if (url.includes("/users/@me")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              id: "discord_uid_existing",
              username: "existinguser",
              email: "existing@example.com",
              verified: true,
            }),
          });
        }
        return originalFetch(url);
      });

      // Existing oauth account found
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([{ userId: "user-abc-123", provider: "discord", providerAccountId: "discord_uid_existing" }]),
          }),
        }),
      } as any);

      const req = new NextRequest(`http://localhost:3000/api/auth/discord/callback?code=valid_code&state=${state}`);
      const res = await discordCallbackGet(req);

      expect(res.status).toBe(303);
      expect(res.headers.get("Location")).toBe("http://localhost:3000/master");
      expect(createSession).toHaveBeenCalledWith("user-abc-123", expect.anything(), expect.anything());

      global.fetch = originalFetch;
    });

    it("links discord account to authenticated user when session exists", async () => {
      const state = createDiscordState("/profile");
      const { db } = await import("@/lib/db");
      const { getSession } = await import("@/lib/auth/session");

      vi.mocked(getSession).mockResolvedValueOnce({
        user: { id: "authenticated-user-id" } as any,
        session: {} as any,
      });

      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes("/oauth2/token")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ access_token: "test_token", token_type: "Bearer" }),
          });
        }
        if (url.includes("/users/@me")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              id: "discord_uid_to_link",
              username: "linkeduser",
              email: "different_email@example.com",
              verified: true,
            }),
          });
        }
        return originalFetch(url);
      });

      // No oauth account for this discord id
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([]),
          }),
        }),
      } as any);

      const insertValuesMock = vi.fn().mockResolvedValueOnce({});
      vi.mocked(db.insert).mockReturnValueOnce({
        values: insertValuesMock,
      } as any);

      const req = new NextRequest(`http://localhost:3000/api/auth/discord/callback?code=valid_code&state=${state}`);
      const res = await discordCallbackGet(req);

      expect(res.status).toBe(303);
      expect(res.headers.get("Location")).toBe("http://localhost:3000/profile");
      expect(insertValuesMock).toHaveBeenCalledWith({
        userId: "authenticated-user-id",
        provider: "discord",
        providerAccountId: "discord_uid_to_link",
      });

      global.fetch = originalFetch;
    });
  });
});
