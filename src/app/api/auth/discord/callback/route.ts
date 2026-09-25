import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, oauthAccounts } from "@/lib/db/schema";
import { eq, and, ilike } from "drizzle-orm";
import { createSession, getSession } from "@/lib/auth/session";
import { validateDiscordState, validateDiscordProfile, type DiscordProfile } from "@/lib/auth/discord";
import { getPublicOrigin } from "@/lib/auth/redirect";
import { logger } from "@/lib/logger";

function redirectWithError(origin: string, error: string) {
  const url = new URL("/login", origin);
  url.searchParams.set("error", error);
  const res = NextResponse.redirect(url.toString(), 303);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function GET(request: NextRequest) {
  const origin = getPublicOrigin(request);
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const stateRaw = searchParams.get("state");
  const oauthError = searchParams.get("error");

  if (oauthError) {
    logger.warn({ oauthError }, "Discord OAuth access denied or error returned");
    return redirectWithError(origin, "oauth_access_denied");
  }

  if (!code || !stateRaw) {
    return redirectWithError(origin, "oauth_invalid_request");
  }

  const validatedState = validateDiscordState(stateRaw);
  if (!validatedState) {
    return redirectWithError(origin, "oauth_state_invalid");
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const callbackUrl =
    process.env.DISCORD_CALLBACK_URL ||
    `${origin}/api/auth/discord/callback`;

  if (!clientId || !clientSecret) {
    logger.error("Discord OAuth credentials not configured");
    return redirectWithError(origin, "oauth_not_configured");
  }

  let tokenData: { access_token?: string; token_type?: string };
  try {
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: callbackUrl,
      }),
    });

    if (!tokenResponse.ok) {
      logger.error({ status: tokenResponse.status }, "Discord token exchange failed");
      return redirectWithError(origin, "oauth_token_exchange_failed");
    }

    tokenData = await tokenResponse.json();
  } catch (err) {
    logger.error({ err }, "Discord token request network error");
    return redirectWithError(origin, "oauth_token_exchange_failed");
  }

  let profile: DiscordProfile;
  try {
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `${tokenData.token_type || "Bearer"} ${tokenData.access_token}`,
      },
    });

    if (!userResponse.ok) {
      logger.error({ status: userResponse.status }, "Discord profile fetch failed");
      return redirectWithError(origin, "oauth_profile_fetch_failed");
    }

    profile = await userResponse.json();
  } catch (err) {
    logger.error({ err }, "Discord profile network error");
    return redirectWithError(origin, "oauth_profile_fetch_failed");
  }

  let validatedProfile: ReturnType<typeof validateDiscordProfile>;
  try {
    validatedProfile = validateDiscordProfile(profile);
  } catch (err: any) {
    if (err?.message === "discord_email_unverified") {
      return redirectWithError(origin, "discord_email_unverified");
    }
    return redirectWithError(origin, "oauth_profile_invalid");
  }

  try {
    const [existingAccount] = await db
      .select()
      .from(oauthAccounts)
      .where(
        and(
          eq(oauthAccounts.provider, "discord"),
          eq(oauthAccounts.providerAccountId, validatedProfile.providerAccountId)
        )
      )
      .limit(1);

    let targetUserId: string;

    const currentSession = await getSession();

    if (existingAccount) {
      if (currentSession && currentSession.user.id !== existingAccount.userId) {
        return redirectWithError(origin, "oauth_account_linked_to_other");
      }
      targetUserId = existingAccount.userId;
    } else {
      if (currentSession) {
        targetUserId = currentSession.user.id;
        await db.insert(oauthAccounts).values({
          userId: targetUserId,
          provider: "discord",
          providerAccountId: validatedProfile.providerAccountId,
        });
      } else {
        const [existingUserByEmail] = await db
          .select()
          .from(users)
          .where(ilike(users.email, validatedProfile.email))
          .limit(1);

        if (existingUserByEmail) {
          return redirectWithError(origin, "account_linking_required");
        }

        const [newUser] = await db
          .insert(users)
          .values({
            email: validatedProfile.email,
            displayName: validatedProfile.displayName,
            role: "player",
            oauthProvider: "discord",
          })
          .returning();

        targetUserId = newUser.id;

        await db.insert(oauthAccounts).values({
          userId: targetUserId,
          provider: "discord",
          providerAccountId: validatedProfile.providerAccountId,
        });
      }
    }

    const destination = validatedState.redirect || "/";
    const redirectResponse = NextResponse.redirect(
      new URL(destination, origin),
      303
    );
    redirectResponse.headers.set("Cache-Control", "no-store");

    await createSession(targetUserId, request, redirectResponse);

    return redirectResponse;
  } catch (error) {
    logger.error({ error }, "Error completing Discord OAuth flow");
    return redirectWithError(origin, "oauth_processing_failed");
  }
}
