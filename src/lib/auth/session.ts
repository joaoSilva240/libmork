// =============================================================================
// Libmork — Autenticação: Gerenciamento de Sessão (D-44)
// =============================================================================
// Sessões gerenciadas via cookies HTTP-only.
// =============================================================================

import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { sessions, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateToken } from "@/lib/utils/tokens";

const SESSION_COOKIE_NAME = "libmork_session";
const SESSION_DURATION_DAYS = 30;

/**
 * Cria uma nova sessão para o usuário e define o cookie HTTP-only (D-44).
 * @param userId ID do usuário
 * @returns Token da sessão
 */
export async function createSession(userId: string): Promise<string> {
  const token = generateToken(32);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

  await db.insert(sessions).values({
    userId,
    token,
    expiresAt,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });

  return token;
}

/**
 * Valida um token de sessão diretamente (útil para WebSockets / Handshake).
 * @param token Token da sessão
 */
export async function verifySessionToken(token: string): Promise<{
  user: typeof users.$inferSelect;
  session: typeof sessions.$inferSelect;
} | null> {
  if (!token) return null;

  const result = await db
    .select()
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.token, token))
    .limit(1);

  if (result.length === 0) return null;

  const { sessions: session, users: user } = result[0];

  if (new Date() > session.expiresAt) {
    await db.delete(sessions).where(eq(sessions.token, token));
    return null;
  }

  return { user, session };
}

/**
 * Recupera a sessão atual do cookie e valida no banco.
 * @returns Dados do usuário autenticado ou null
 */
export async function getSession(): Promise<{
  user: typeof users.$inferSelect;
  session: typeof sessions.$inferSelect;
} | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const result = await db
    .select()
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.token, token))
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  const { sessions: session, users: user } = result[0];

  // Verifica se a sessão expirou
  if (new Date() > session.expiresAt) {
    await destroySession();
    return null;
  }

  return { user, session };
}

/**
 * Destrói a sessão atual (logout).
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await db.delete(sessions).where(eq(sessions.token, token));
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Valida se há uma sessão ativa. Retorna null se não houver.
 */
export async function requireAuth() {
  return getSession();
}
