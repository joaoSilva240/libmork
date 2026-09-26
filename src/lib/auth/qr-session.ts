import { cache } from "@/lib/cache/redis";

export interface QrSessionData {
  status: "PENDING" | "AUTHENTICATED" | "EXPIRED";
  userId?: string;
  sessionToken?: string;
  createdAt: number;
}

export async function createQrSession(qrSessionId: string): Promise<void> {
  const data: QrSessionData = {
    status: "PENDING",
    createdAt: Date.now(),
  };
  await cache.set(`qr_session:${qrSessionId}`, data, 120);
}

export async function getQrSession(qrSessionId: string): Promise<QrSessionData | null> {
  return await cache.get<QrSessionData>(`qr_session:${qrSessionId}`);
}

export async function authorizeQrSession(qrSessionId: string, userId: string, sessionToken: string): Promise<boolean> {
  const session = await getQrSession(qrSessionId);
  if (!session || session.status !== "PENDING") return false;

  const updated: QrSessionData = {
    ...session,
    status: "AUTHENTICATED",
    userId,
    sessionToken,
  };

  await cache.set(`qr_session:${qrSessionId}`, updated, 120);
  return true;
}

export async function consumeQrSession(qrSessionId: string): Promise<boolean> {
  await cache.del(`qr_session:${qrSessionId}`);
  return true;
}
