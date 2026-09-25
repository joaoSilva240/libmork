import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const STATE_TTL_MS = 10 * 60 * 1000;

export type DiscordState = { nonce: string; redirect: string; issuedAt: number };

function secret() {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";
}

export function createDiscordState(redirect = "/"): string {
  const payload: DiscordState = { nonce: randomBytes(24).toString("hex"), redirect, issuedAt: Date.now() };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function validateDiscordState(value: string | null): DiscordState | null {
  if (!value || !secret()) return null;
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature) return null;
  const expected = createHmac("sha256", secret()).update(encoded).digest("base64url");
  const a = Buffer.from(signature); const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const state = JSON.parse(Buffer.from(encoded, "base64url").toString()) as DiscordState;
    return state.nonce && Date.now() - state.issuedAt <= STATE_TTL_MS ? state : null;
  } catch { return null; }
}

export type DiscordProfile = { id?: string; username?: string; global_name?: string; email?: string | null; verified?: boolean };
export function validateDiscordProfile(profile: DiscordProfile) {
  if (!profile.id) throw new Error("discord_profile_invalid");
  if (!profile.email || profile.verified !== true) throw new Error("discord_email_unverified");
  return { provider: "discord", providerAccountId: profile.id, email: profile.email.trim().toLowerCase(), displayName: (profile.global_name || profile.username || "Discord user").slice(0, 100) };
}
