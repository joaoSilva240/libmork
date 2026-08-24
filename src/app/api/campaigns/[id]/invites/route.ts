// =============================================================================
// Libmork — API Route: Convites de Campanha (RF-015)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { campaigns, campaignInvites } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { generateUrlSafeToken } from "@/lib/utils/tokens";
import { eq, and } from "drizzle-orm";

type RouteContext = { params: Promise<{ id: string }> };

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]", "[::]"]);

function isInternalHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (LOOPBACK_HOSTS.has(host) || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return true;
  }

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;

  const [first, second, third, fourth] = ipv4.slice(1).map(Number);
  if ([first, second, third, fourth].some((part) => part > 255)) return true;

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254)
  );
}

function isPublicOrigin(value: string): boolean {
  try {
    if (/[\r\n\x00-\x1f\x7f]/.test(value)) return false;
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      !url.username &&
      !url.password &&
      !url.pathname.replace(/\/$/, "") &&
      !url.search &&
      !url.hash &&
      !isInternalHost(url.hostname)
    );
  } catch {
    return false;
  }
}

function forwardedOrigin(request: NextRequest): string | null {
  const host = request.headers.get("x-forwarded-host")?.split(",", 1)[0]?.trim();
  const protocol = request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim().toLowerCase();

  if (
    !host ||
    !protocol ||
    /[\x00-\x20\x7f\r\n]/.test(host) ||
    !/^(?:[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?|\[[0-9a-f:.]+\])(?::\d{1,5})?$/i.test(host) ||
    (protocol !== "http" && protocol !== "https")
  ) {
    return null;
  }

  const origin = `${protocol}://${host}`;
  return isPublicOrigin(origin) ? origin : null;
}

function getPublicBaseUrl(request: NextRequest): string {
  const requestOrigin = request.nextUrl.origin;
  const requestIsPublic = isPublicOrigin(requestOrigin);
  const proxyOrigin = forwardedOrigin(request);

  if (requestIsPublic) return requestOrigin;
  if (proxyOrigin) return proxyOrigin;

  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configuredOrigin && isPublicOrigin(configuredOrigin)) {
    return new URL(configuredOrigin).origin;
  }

  return requestOrigin;
}

/**
 * GET /api/campaigns/:id/invites
 * Lista convites da campanha (apenas o mestre).
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.masterId, session.user.id)))
      .limit(1);

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campanha não encontrada" },
        { status: 404 }
      );
    }

    const invites = await db
      .select()
      .from(campaignInvites)
      .where(eq(campaignInvites.campaignId, id))
      .orderBy(campaignInvites.createdAt);

    const baseUrl = getPublicBaseUrl(request);

    return NextResponse.json({
      success: true,
      data: invites.map((invite) => ({
        ...invite,
        url: `${baseUrl}/invite/${invite.token}`,
      })),
    });
  } catch (error) {
    console.error("Erro ao listar convites:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/campaigns/:id/invites
 * Gera um novo convite com token de alta entropia (apenas o mestre).
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await requireAuth();

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Não autenticado" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.masterId, session.user.id)))
      .limit(1);

    if (!campaign) {
      return NextResponse.json(
        { success: false, error: "Campanha não encontrada" },
        { status: 404 }
      );
    }

    const token = generateUrlSafeToken(32);

    const [newInvite] = await db
      .insert(campaignInvites)
      .values({
        campaignId: id,
        token,
        revoked: false,
      })
      .returning();

    const baseUrl = getPublicBaseUrl(request);

    return NextResponse.json(
      {
        success: true,
        data: {
          ...newInvite,
          url: `${baseUrl}/invite/${newInvite.token}`,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro ao gerar convite:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
