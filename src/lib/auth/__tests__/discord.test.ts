import { describe, it, expect, beforeEach } from "vitest";
import { createDiscordState, validateDiscordState, validateDiscordProfile } from "../discord";

describe("Discord OAuth State Management", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-secret-key-for-hmac-signing-minimum-32-chars";
  });

  it("creates a state token with redirect and validates it", () => {
    const state = createDiscordState("/player");
    expect(state).toBeTruthy();
    expect(state.includes(".")).toBe(true);

    const validated = validateDiscordState(state);
    expect(validated).not.toBeNull();
    expect(validated?.redirect).toBe("/player");
    expect(validated?.nonce).toBeTruthy();
  });

  it("rejects tampered state signature", () => {
    const state = createDiscordState("/");
    const [encoded] = state.split(".");
    const tampered = `${encoded}.invalid_signature`;
    
    const validated = validateDiscordState(tampered);
    expect(validated).toBeNull();
  });

  it("rejects expired state (over 10 minutes old)", () => {
    const oldTimestamp = Date.now() - 11 * 60 * 1000;
    const payload = { nonce: "test", redirect: "/", issuedAt: oldTimestamp };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    
    const { createHmac } = require("node:crypto");
    const signature = createHmac("sha256", process.env.AUTH_SECRET!)
      .update(encoded)
      .digest("base64url");
    
    const expiredState = `${encoded}.${signature}`;
    const validated = validateDiscordState(expiredState);
    expect(validated).toBeNull();
  });

  it("rejects state when AUTH_SECRET is missing", () => {
    const state = createDiscordState("/");
    delete process.env.AUTH_SECRET;
    
    const validated = validateDiscordState(state);
    expect(validated).toBeNull();
  });
});

describe("Discord Profile Validation", () => {
  it("validates a complete Discord profile with verified email", () => {
    const profile = {
      id: "123456789",
      username: "testuser",
      global_name: "Test User",
      email: "test@example.com",
      verified: true,
    };

    const result = validateDiscordProfile(profile);
    expect(result.provider).toBe("discord");
    expect(result.providerAccountId).toBe("123456789");
    expect(result.email).toBe("test@example.com");
    expect(result.displayName).toBe("Test User");
  });

  it("falls back to username when global_name is missing", () => {
    const profile = {
      id: "123456789",
      username: "testuser",
      email: "test@example.com",
      verified: true,
    };

    const result = validateDiscordProfile(profile);
    expect(result.displayName).toBe("testuser");
  });

  it("throws discord_email_unverified when email is not verified", () => {
    const profile = {
      id: "123456789",
      username: "testuser",
      email: "test@example.com",
      verified: false,
    };

    expect(() => validateDiscordProfile(profile)).toThrow("discord_email_unverified");
  });

  it("throws discord_email_unverified when email is null", () => {
    const profile = {
      id: "123456789",
      username: "testuser",
      email: null,
      verified: true,
    };

    expect(() => validateDiscordProfile(profile)).toThrow("discord_email_unverified");
  });

  it("throws discord_profile_invalid when id is missing", () => {
    const profile = {
      username: "testuser",
      email: "test@example.com",
      verified: true,
    };

    expect(() => validateDiscordProfile(profile as any)).toThrow("discord_profile_invalid");
  });

  it("normalizes email to lowercase and trims whitespace", () => {
    const profile = {
      id: "123456789",
      username: "testuser",
      email: "  TEST@EXAMPLE.COM  ",
      verified: true,
    };

    const result = validateDiscordProfile(profile);
    expect(result.email).toBe("test@example.com");
  });

  it("truncates displayName to 100 characters", () => {
    const longName = "A".repeat(150);
    const profile = {
      id: "123456789",
      username: "testuser",
      global_name: longName,
      email: "test@example.com",
      verified: true,
    };

    const result = validateDiscordProfile(profile);
    expect(result.displayName.length).toBe(100);
  });
});
