import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";

const updateProfileSchema = z.object({
  masterName: z.string().trim().max(100, "Nome de mestre deve ter no máximo 100 caracteres").optional().nullable(),
  masterAvatar: z
    .string()
    .trim()
    .max(500, "URL do avatar deve ter no máximo 500 caracteres")
    .url("URL do avatar inválida")
    .or(z.literal(""))
    .optional()
    .nullable(),
  masterBio: z.string().trim().max(500, "Bio deve ter no máximo 500 caracteres").optional().nullable(),
  masterBannerUrl: z
    .string()
    .trim()
    .max(500, "URL do banner deve ter no máximo 500 caracteres")
    .url("URL do banner inválida")
    .or(z.literal(""))
    .optional()
    .nullable(),
});

export async function PUT(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!session) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 });
    }

    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const updateData: Partial<typeof users.$inferInsert> = {};
    if (parsed.data.masterName !== undefined) {
      updateData.masterName = parsed.data.masterName ? parsed.data.masterName.trim() : null;
    }
    if (parsed.data.masterAvatar !== undefined) {
      updateData.masterAvatar = parsed.data.masterAvatar ? parsed.data.masterAvatar.trim() : null;
    }
    if (parsed.data.masterBio !== undefined) {
      updateData.masterBio = parsed.data.masterBio ? parsed.data.masterBio.trim() : null;
    }
    if (parsed.data.masterBannerUrl !== undefined) {
      updateData.masterBannerUrl = parsed.data.masterBannerUrl ? parsed.data.masterBannerUrl.trim() : null;
    }

    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, session.user.id))
      .returning({
        id: users.id,
        displayName: users.displayName,
        masterName: users.masterName,
        masterAvatar: users.masterAvatar,
        masterBio: users.masterBio,
        masterBannerUrl: users.masterBannerUrl,
      });

    return NextResponse.json({
      success: true,
      message: "Perfil de mestre atualizado com sucesso",
      profile: {
        id: updatedUser.id,
        displayName: updatedUser.displayName,
        masterName: updatedUser.masterName || updatedUser.displayName,
        masterAvatar: updatedUser.masterAvatar,
        masterBio: updatedUser.masterBio,
        masterBannerUrl: updatedUser.masterBannerUrl,
      },
    });
  } catch (error) {
    console.error("Erro ao atualizar perfil de mestre:", error);
    return NextResponse.json(
      { error: "Erro ao atualizar perfil de mestre" },
      { status: 500 }
    );
  }
}
