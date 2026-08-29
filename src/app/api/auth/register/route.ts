// =============================================================================
// Libmork — API Route: Registro de Usuário (RF-001)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { registerSchema } from "@/lib/validators/auth";
import { ilike } from "drizzle-orm";
import { getPublicOrigin, getSafeRedirect } from "@/lib/auth/redirect";
import { logger } from "@/lib/logger";

function formErrorResponse(request: NextRequest, errorCode: string) {
  const params = new URLSearchParams({ error: errorCode });
  const response = NextResponse.redirect(
    new URL(`/register?${params.toString()}`, getPublicOrigin(request)),
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
        displayName: form.get("displayName"),
        email: form.get("email"),
        password: form.get("password"),
        role: form.get("role") || "player",
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

    const validation = registerSchema.safeParse(body);

    if (!validation.success) {
      if (!isJson) return formErrorResponse(request, "invalid_data");
      return NextResponse.json(
        { 
          success: false, 
          error: "Dados inválidos",
          errors: validation.error.issues 
        },
        { status: 400 }
      );
    }

    const { email, password, displayName, role } = validation.data;
    const normalizedEmail = email.trim().toLowerCase();

    // Verifica se o e-mail já existe
    const existingUser = await db
      .select()
      .from(users)
      .where(ilike(users.email, normalizedEmail))
      .limit(1);

    if (existingUser.length > 0) {
      if (!isJson) return formErrorResponse(request, "email_exists");
      return NextResponse.json(
        { success: false, error: "E-mail já cadastrado" },
        { status: 409 }
      );
    }

    // Cria o usuário
    const passwordHash = await hashPassword(password);
    const [newUser] = await db
      .insert(users)
      .values({
        email: normalizedEmail,
        passwordHash,
        displayName: displayName.trim(),
        role,
        oauthProvider: "local",
      })
      .returning();

    // Cria a sessão
    const destination = redirect || "/";
    if (!isJson) {
      const response = NextResponse.redirect(
        new URL(destination, getPublicOrigin(request)),
        303,
      );
      response.headers.set("Cache-Control", "no-store");
      try {
        await createSession(newUser.id, request, response);
      } catch (err) {
        logger.error({ err }, "Erro ao criar sessão após registro");
        return formErrorResponse(request, "server_error");
      }
      return response;
    }

    const jsonResponse = NextResponse.json({
      success: true,
      data: {
        id: newUser.id,
        email: newUser.email,
        displayName: newUser.displayName,
        role: newUser.role,
        redirect: destination,
      },
    });

    try {
      await createSession(newUser.id, request, jsonResponse);
    } catch (err) {
      logger.error({ err }, "Erro ao criar sessão após registro");
      return NextResponse.json(
        { success: false, error: "Erro interno do servidor" },
        { status: 500 }
      );
    }

    return jsonResponse;
  } catch (error) {
    logger.error({ err: error }, "Erro ao registrar usuário");
    if (!isJson) return formErrorResponse(request, "server_error");
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(
    new URL("/register", getPublicOrigin(request)),
    303,
  );
  response.headers.set("Cache-Control", "no-store");
  return response;
}
