// =============================================================================
// Libmork — API Route: Login (RF-002)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { loginSchema } from "@/lib/validators/auth";
import { eq } from "drizzle-orm";
import { getPublicOrigin, getSafeRedirect } from "@/lib/auth/redirect";

const GENERIC_LOGIN_ERROR = "login_failed";
const LOGIN_OPERATIONAL_FAILURE = "AUTH_LOGIN_OPERATIONAL_FAILURE";

type LoginStage = "lookup" | "password_verify" | "session_create";

function logOperationalFailure(stage: LoginStage): void {
  console.error(LOGIN_OPERATIONAL_FAILURE, { status: "error", stage });
}

function formErrorResponse(request: NextRequest, redirect: string | null) {
  const params = new URLSearchParams({ error: GENERIC_LOGIN_ERROR });
  if (redirect) params.set("redirect", redirect);
  const response = NextResponse.redirect(
    new URL(`/login?${params.toString()}`, getPublicOrigin(request)),
    303,
  );
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";
  const isJson = contentType.toLowerCase().includes("application/json");
  let body: Record<string, unknown>;
  let redirect: string | null = null;
  let stage: LoginStage = "lookup";

  try {
    if (isJson) {
      body = await request.json();
      redirect = getSafeRedirect(
        typeof body.redirect === "string" ? body.redirect : null,
        request.url,
      );
    } else if (
      contentType.toLowerCase().includes("application/x-www-form-urlencoded") ||
      contentType.toLowerCase().includes("multipart/form-data")
    ) {
      const form = await request.formData();
      body = {
        email: form.get("email"),
        password: form.get("password"),
      };
      const formRedirect = form.get("redirect");
      redirect = getSafeRedirect(
        typeof formRedirect === "string" ? formRedirect : null,
        request.url,
      );
    } else {
      return NextResponse.json(
        { success: false, error: "Dados inválidos" },
        { status: 400 },
      );
    }

      const validation = loginSchema.safeParse(body);

    if (!validation.success) {
       if (!isJson) return formErrorResponse(request, redirect);
      return NextResponse.json(
        { 
          success: false, 
          error: "Dados inválidos",
          errors: validation.error.issues 
        },
        { status: 400 }
      );
    }

    const { email, password } = validation.data;
    // The current storage and registration flow preserve email casing, so a
    // case-normalized lookup would not be compatible with existing accounts.
    const lookupEmail = email;

    // Busca o usuário
    let user: typeof users.$inferSelect | undefined;
    try {
      [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, lookupEmail))
        .limit(1);
    } catch {
      logOperationalFailure("lookup");
      if (!isJson) return formErrorResponse(request, redirect);
      return NextResponse.json(
        { success: false, error: "Erro interno do servidor" },
        { status: 500 },
      );
    }

    if (!user || !user.passwordHash) {
      if (!isJson) return formErrorResponse(request, redirect);
      return NextResponse.json(
        { success: false, error: "E-mail ou senha incorretos" },
        { status: 401 }
      );
    }

    // Verifica a senha
    let isPasswordValid: boolean;
    stage = "password_verify";
    try {
      isPasswordValid = await verifyPassword(password, user.passwordHash);
    } catch {
      logOperationalFailure("password_verify");
      if (!isJson) return formErrorResponse(request, redirect);
      return NextResponse.json(
        { success: false, error: "Erro interno do servidor" },
        { status: 500 },
      );
    }

    if (!isPasswordValid) {
      if (!isJson) return formErrorResponse(request, redirect);
      return NextResponse.json(
        { success: false, error: "E-mail ou senha incorretos" },
        { status: 401 }
      );
    }

    // Cria a sessão
    stage = "session_create";
    if (!isJson) {
      const destination = redirect || (user.role === "master" ? "/master" : "/player");
      const response = NextResponse.redirect(
        new URL(destination, getPublicOrigin(request)),
        303,
      );
      response.headers.set("Cache-Control", "no-store");
      try {
        await createSession(user.id, request, response);
      } catch {
        logOperationalFailure("session_create");
        return formErrorResponse(request, redirect);
      }
      return response;
    }

    try {
      await createSession(user.id, request);
    } catch {
      logOperationalFailure("session_create");
      return NextResponse.json(
        { success: false, error: "Erro interno do servidor" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
    });
  } catch {
    logOperationalFailure(stage);
    if (!isJson) return formErrorResponse(request, redirect);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(
    new URL("/login", getPublicOrigin(request)),
    303,
  );
  response.headers.set("Cache-Control", "no-store");
  return response;
}
