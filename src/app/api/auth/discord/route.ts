import { NextRequest, NextResponse } from "next/server";
import { createDiscordState } from "@/lib/auth/discord";
import { getPublicOrigin, getSafeRedirect } from "@/lib/auth/redirect";

export async function GET(request: NextRequest) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "discord_not_configured" }, { status: 500 });
  }

  const origin = getPublicOrigin(request);
  const redirectParam = request.nextUrl.searchParams.get("redirect");
  const safeRedirect = getSafeRedirect(redirectParam, request.url) || "/";
  const state = createDiscordState(safeRedirect);

  const callbackUrl =
    process.env.DISCORD_CALLBACK_URL ||
    `${origin}/api/auth/discord/callback`;

  const discordUrl = new URL("https://discord.com/api/oauth2/authorize");
  discordUrl.searchParams.set("client_id", clientId);
  discordUrl.searchParams.set("redirect_uri", callbackUrl);
  discordUrl.searchParams.set("response_type", "code");
  discordUrl.searchParams.set("scope", "identify email");
  discordUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(discordUrl.toString(), 302);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
