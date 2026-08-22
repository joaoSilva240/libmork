// =============================================================================
// Libmork — Rota NFC: Desbloqueio via URL NDEF (RF-021, RF-022, D-04)
// =============================================================================
// Redirecionamento HTTP GET padrão compatível com iOS e Android.
// =============================================================================

import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { nfcTags } from "@/lib/db/schema";
import { getSession } from "@/lib/auth/session";
import { eq, and, like } from "drizzle-orm";

export default async function NfcPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const [tag] = await db
    .select()
    .from(nfcTags)
    .where(
      and(like(nfcTags.ndefUrl, `%/nfc/${token}`), eq(nfcTags.active, true))
    )
    .limit(1);

  if (!tag) {
    notFound();
  }

  const session = await getSession();

  // Etiqueta sem personagem associado => estado de criação de personagem (RF-022)
  if (!tag.characterId) {
    if (session) {
      redirect("/player/characters/new");
    }
    redirect(`/login?redirect=${encodeURIComponent("/player/characters/new")}`);
  }

  // Etiqueta com personagem => desbloqueio da ficha (RF-022)
  if (session) {
    redirect(`/player/characters/${tag.characterId}`);
  }

  redirect(
    `/login?redirect=${encodeURIComponent(`/player/characters/${tag.characterId}`)}`
  );
}
