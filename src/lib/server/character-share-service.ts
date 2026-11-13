// =============================================================================
// Libmork — Serviço de compartilhamento e aquisição de personagens (Issue #79)
// =============================================================================
// Links de visualização pública (kind "view") e de aquisição/clonagem
// (kind "acquire") sobre a tabela publicShareLinks, além do hub off-session.

import { and, eq, inArray, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  campaignSessions,
  characterCampaigns,
  characterItems,
  characterSkills,
  characterSpells,
  characters,
  campaigns,
  publicShareLinks,
  rpgClasses,
  rpgRaces,
  users,
} from "@/lib/db/schema";
import { generateUrlSafeToken } from "@/lib/utils/tokens";
import { XP_PER_LEVEL } from "@/lib/utils/constants";

export type ShareKind = "view" | "acquire";

export type CharacterHub = {
  id: string;
  ownerId: string;
  isOwner: boolean;
  name: string;
  imageUrl: string | null;
  description: string | null;
  level: number;
  xp: number;
  xpToNextLevel: number;
  raceName: string | null;
  className: string | null;
  activeSession: {
    sessionId: string;
    campaignId: string;
    campaignName: string;
    scheduledAt: string;
  } | null;
};

export type PublicOffSessionSheet = {
  name: string;
  imageUrl: string | null;
  description: string | null;
  level: number;
  xp: number;
  raceName: string | null;
  className: string | null;
};

export type AcquirePreview = {
  characterId: string;
  name: string;
  imageUrl: string | null;
  description: string | null;
  level: number;
  xp: number;
  raceName: string | null;
  className: string | null;
  ownerName: string | null;
  isOwn: boolean;
};

async function resolveNames(row: {
  raceId: string | null;
  classId: string | null;
  ownerId?: string;
}) {
  let raceName: string | null = null;
  let className: string | null = null;
  if (row.raceId) {
    const [race] = await db
      .select({ name: rpgRaces.name })
      .from(rpgRaces)
      .where(eq(rpgRaces.id, row.raceId))
      .limit(1);
    raceName = race?.name ?? null;
  }
  if (row.classId) {
    const [rpgClass] = await db
      .select({ name: rpgClasses.name })
      .from(rpgClasses)
      .where(eq(rpgClasses.id, row.classId))
      .limit(1);
    className = rpgClass?.name ?? null;
  }
  return { raceName, className };
}

/**
 * Sessão em andamento: confirmada, começada e dentro da duração,
 * em campanhas onde o personagem tem vínculo aprovado.
 */
async function findActiveSession(characterId: string): Promise<CharacterHub["activeSession"]> {
  const links = await db
    .select({ campaignId: characterCampaigns.campaignId })
    .from(characterCampaigns)
    .where(
      and(
        eq(characterCampaigns.characterId, characterId),
        eq(characterCampaigns.approvalStatus, "approved"),
      ),
    );
  if (links.length === 0) return null;

  const campaignIds = links.map((l) => l.campaignId);
  const now = new Date();
  const rows = await db
    .select({
      sessionId: campaignSessions.id,
      campaignId: campaignSessions.campaignId,
      campaignName: campaigns.name,
      scheduledAt: campaignSessions.scheduledAt,
      durationMinutes: campaignSessions.durationMinutes,
    })
    .from(campaignSessions)
    .innerJoin(campaigns, eq(campaigns.id, campaignSessions.campaignId))
    .where(
      and(
        inArray(campaignSessions.campaignId, campaignIds),
        eq(campaignSessions.status, "confirmed"),
        lte(campaignSessions.scheduledAt, now),
      ),
    );

  const active = rows.find(
    (r) =>
      r.scheduledAt !== null &&
      r.scheduledAt.getTime() + r.durationMinutes * 60_000 >= now.getTime(),
  );
  if (!active || !active.scheduledAt) return null;

  return {
    sessionId: active.sessionId,
    campaignId: active.campaignId,
    campaignName: active.campaignName,
    scheduledAt: active.scheduledAt.toISOString(),
  };
}

/**
 * Hub off-session do personagem para o visualizador.
 */
export async function getCharacterHub(
  characterId: string,
  viewerId: string | null,
): Promise<CharacterHub> {
  const [character] = await db
    .select()
    .from(characters)
    .where(eq(characters.id, characterId))
    .limit(1);
  if (!character) {
    throw new Error("Personagem não encontrado");
  }
  const { raceName, className } = await resolveNames(character);
  const activeSession = await findActiveSession(characterId);

  return {
    id: character.id,
    ownerId: character.ownerId,
    isOwner: viewerId === character.ownerId,
    name: character.name,
    imageUrl: character.imageUrl,
    description: character.description ?? null,
    level: character.level,
    xp: character.xp,
    xpToNextLevel: XP_PER_LEVEL,
    raceName,
    className,
    activeSession,
  };
}

/**
 * Frente pública off-session via token de visualização (sem autenticação).
 */
export async function getPublicOffSession(token: string): Promise<PublicOffSessionSheet> {
  const [link] = await db
    .select()
    .from(publicShareLinks)
    .where(
      and(
        eq(publicShareLinks.token, token),
        eq(publicShareLinks.revoked, false),
        eq(publicShareLinks.kind, "view"),
      ),
    )
    .limit(1);
  if (!link) {
    throw new Error("Link inválido ou revogado");
  }

  const [character] = await db
    .select()
    .from(characters)
    .where(eq(characters.id, link.characterId))
    .limit(1);
  if (!character) {
    throw new Error("Personagem não encontrado");
  }
  const { raceName, className } = await resolveNames(character);

  return {
    name: character.name,
    imageUrl: character.imageUrl,
    description: character.description ?? null,
    level: character.level,
    xp: character.xp,
    raceName,
    className,
  };
}

async function resolveAcquireToken(token: string) {
  const [link] = await db
    .select()
    .from(publicShareLinks)
    .where(
      and(
        eq(publicShareLinks.token, token),
        eq(publicShareLinks.revoked, false),
        eq(publicShareLinks.kind, "acquire"),
      ),
    )
    .limit(1);
  if (!link) {
    throw new Error("Link inválido ou revogado");
  }
  const [character] = await db
    .select()
    .from(characters)
    .where(eq(characters.id, link.characterId))
    .limit(1);
  if (!character) {
    throw new Error("Personagem não encontrado");
  }
  return { link, character };
}

/**
 * Preview da aquisição para jogador autenticado.
 */
export async function getAcquirePreview(token: string, viewerId: string): Promise<AcquirePreview> {
  const { character } = await resolveAcquireToken(token);
  const { raceName, className } = await resolveNames(character);

  const [owner] = await db
    .select({ displayName: users.displayName, masterName: users.masterName })
    .from(users)
    .where(eq(users.id, character.ownerId))
    .limit(1);

  return {
    characterId: character.id,
    name: character.name,
    imageUrl: character.imageUrl,
    description: character.description ?? null,
    level: character.level,
    xp: character.xp,
    raceName,
    className,
    ownerName: owner?.displayName || owner?.masterName || null,
    isOwn: character.ownerId === viewerId,
  };
}

/**
 * Payload de inserção da cópia: integral, mas com novo dono, vitais
 * restaurados ao máximo e estado de morte zerado. Sem id/timestamps.
 */
export function buildCloneValues(source: typeof characters.$inferSelect, newOwnerId: string) {
  return {
    ownerId: newOwnerId,
    classId: source.classId,
    raceId: source.raceId,
    activeHeritages: source.activeHeritages,
    name: source.name,
    imageUrl: source.imageUrl,
    description: source.description,
    hitPointsMax: source.hitPointsMax,
    hitPointsCurrent: source.hitPointsMax,
    manaPointsMax: source.manaPointsMax,
    manaPointsCurrent: source.manaPointsMax,
    attributes: source.attributes,
    level: source.level,
    xp: source.xp,
    block: source.block,
    deathStatus: "alive" as const,
    deathSuccesses: 0,
    deathFailures: 0,
    coins: source.coins,
  };
}

/**
 * Duplica integralmente a ficha sob novo dono: atributos, moedas, itens,
 * magias e proficiências. HP/Mana atuais voltam ao máximo e o estado de
 * morte é zerado. Vínculos de campanha, condições e links públicos NÃO
 * são copiados; o original permanece intocado.
 */
export async function acquireCharacter(
  token: string,
  newOwnerId: string,
): Promise<{ characterId: string }> {
  const { character: source } = await resolveAcquireToken(token);
  if (source.ownerId === newOwnerId) {
    throw new Error("Você já possui este personagem");
  }

  const created = await db.transaction(async (tx) => {
    const [copy] = await tx
      .insert(characters)
      .values(buildCloneValues(source, newOwnerId))
      .returning();

    const [skills, spells, itemsRows] = await Promise.all([
      tx.select().from(characterSkills).where(eq(characterSkills.characterId, source.id)),
      tx.select().from(characterSpells).where(eq(characterSpells.characterId, source.id)),
      tx.select().from(characterItems).where(eq(characterItems.characterId, source.id)),
    ]);

    if (skills.length > 0) {
      await tx
        .insert(characterSkills)
        .values(
          skills.map((s) => ({ characterId: copy.id, skillId: s.skillId, trained: s.trained })),
        );
    }
    if (spells.length > 0) {
      await tx
        .insert(characterSpells)
        .values(spells.map((s) => ({ characterId: copy.id, spellId: s.spellId })));
    }
    if (itemsRows.length > 0) {
      await tx.insert(characterItems).values(
        itemsRows.map((i) => ({
          characterId: copy.id,
          itemId: i.itemId,
          quantity: i.quantity,
          hitRoll: i.hitRoll,
          damageRoll: i.damageRoll,
        })),
      );
    }

    return copy;
  });

  return { characterId: created.id };
}

/**
 * Emite um link do tipo informado, revogando os links ativos do mesmo tipo.
 */
export async function issueShareLink(characterId: string, kind: ShareKind) {
  await db
    .update(publicShareLinks)
    .set({ revoked: true })
    .where(
      and(
        eq(publicShareLinks.characterId, characterId),
        eq(publicShareLinks.kind, kind),
        eq(publicShareLinks.revoked, false),
      ),
    );

  const [newLink] = await db
    .insert(publicShareLinks)
    .values({ characterId, token: generateUrlSafeToken(32), kind, revoked: false })
    .returning();

  return newLink;
}
