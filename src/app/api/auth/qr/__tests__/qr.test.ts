import { describe, it, expect, vi, beforeEach } from "vitest";
import { createQrSession, getQrSession, authorizeQrSession, consumeQrSession } from "@/lib/auth/qr-session";

const mockRedisMap = new Map<string, unknown>();

vi.mock("@/lib/cache/redis", () => ({
  getRedisClient: () => ({
    set: vi.fn(async (key: string, val: string) => {
      mockRedisMap.set(key, val);
      return "OK";
    }),
    get: vi.fn(async (key: string) => mockRedisMap.get(key) || null),
    del: vi.fn(async (key: string) => {
      mockRedisMap.delete(key);
      return 1;
    }),
    ttl: vi.fn(async () => 120),
  }),
  cache: {
    get: vi.fn(async (key: string) => (mockRedisMap.get(key) as unknown) || null),
    set: vi.fn(async (key: string, val: unknown) => {
      mockRedisMap.set(key, val);
    }),
    del: vi.fn(async (key: string) => {
      mockRedisMap.delete(key);
    }),
  },
}));

describe("QR Code Session Auth Engine", () => {
  beforeEach(() => {
    mockRedisMap.clear();
  });

  it("should create a PENDING qr session", async () => {
    const qrId = "test-qr-123";
    await createQrSession(qrId);

    const session = await getQrSession(qrId);
    expect(session).not.toBeNull();
    expect(session?.status).toBe("PENDING");
  });

  it("should authorize a PENDING session", async () => {
    const qrId = "test-qr-456";
    await createQrSession(qrId);

    const ok = await authorizeQrSession(qrId, "user-1", "token-abc");
    expect(ok).toBe(true);

    const session = await getQrSession(qrId);
    expect(session?.status).toBe("AUTHENTICATED");
    expect(session?.userId).toBe("user-1");
  });

  it("should consume a session", async () => {
    const qrId = "test-qr-789";
    await createQrSession(qrId);
    await consumeQrSession(qrId);

    const session = await getQrSession(qrId);
    expect(session).toBeNull();
  });
});
