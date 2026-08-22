// =============================================================================
// Libmork — API Route: Registro de Usuário (RF-001)
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { registerSchema } from "@/lib/validators/auth";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = registerSchema.safeParse(body);

    if (!validation.success) {
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

    // Verifica se o e-mail já existe
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
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
        email,
        passwordHash,
        displayName,
        role,
        oauthProvider: "local",
      })
      .returning();

    // Cria a sessão
    await createSession(newUser.id);

    return NextResponse.json({
      success: true,
      data: {
        id: newUser.id,
        email: newUser.email,
        displayName: newUser.displayName,
        role: newUser.role,
      },
    });
  } catch (error) {
    console.error("Erro ao registrar usuário:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
