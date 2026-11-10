// =============================================================================
// Libmork — Chat & Polls Service (Issue #62)
// =============================================================================

import { db } from "@/lib/db";
import {
  campaigns,
  campaignInvites,
  characterCampaigns,
  characters,
  communityPosts,
  users,
  campaignChatGroups,
  campaignChatMembers,
  campaignChatMessages,
  campaignChatPolls,
  campaignChatPollOptions,
  campaignChatPollVotes,
} from "@/lib/db/schema";
import { eq, and, desc, gt, ilike, isNull, sql, inArray } from "drizzle-orm";
import { CONTENT_TYPES, CONTENT_LABELS } from "@/lib/validators/content";
import type { ContentType } from "@/lib/validators/content";
import {
  getContentTable,
  getContentCampaignColumn,
  getContentIdColumn,
  getContentNameColumn,
} from "@/lib/db/content-registry";
import { generateUrlSafeToken } from "@/lib/utils/tokens";
import type {
  CreateChatMessageInput,
  ShareInput,
  UpdateMemberPermissionsInput,
} from "@/lib/validators/chat";

export type MemberPermissions = { canRead: boolean; canWrite: boolean; canShare: boolean };

export type ChatGroupSummary = {
  id: string;
  campaignId: string | null;
  type: "campaign" | "dm";
  name: string;
  avatarUrl: string | null;
  role: "admin" | "member";
  permissions: MemberPermissions;
  unreadCount: number;
  lastMessage: {
    id: string;
    content: string;
    type: "text" | "poll" | "system" | "share";
    createdAt: string;
    senderName: string;
  } | null;
  membersCount: number;
  updatedAt: string;
};

export type ShareKind = "library_item" | "profile" | "post" | "campaign";

export type LibraryItemSnapshot = {
  contentType: string;
  contentId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
};

export type ProfileSnapshot = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
};

export type PostSnapshot = {
  postId: string;
  title: string;
  description: string | null;
  contentType: string;
  tags: string[];
  authorId: string;
  authorName: string;
  payload: Record<string, unknown>;
};

export type CampaignSnapshot = {
  campaignId: string;
  name: string;
  coverImageUrl: string | null;
  inviteToken: string;
  masterName: string;
};

export type SharePayload =
  | { kind: "library_item"; snapshot: LibraryItemSnapshot }
  | { kind: "profile"; snapshot: ProfileSnapshot }
  | { kind: "post"; snapshot: PostSnapshot }
  | { kind: "campaign"; snapshot: CampaignSnapshot };

export type PollOptionDetail = {
  id: string;
  text: string;
  position: number;
  votesCount: number;
  percentage: number;
  hasVoted: boolean;
};

export type PollDetail = {
  id: string;
  title: string;
  isMultipleChoice: boolean;
  status: "open" | "closed";
  closedAt: string | null;
  createdAt: string;
  createdById: string;
  createdByName: string;
  totalVotes: number;
  options: PollOptionDetail[];
  userVotedOptionIds: string[];
};

export type ChatMessageDetail = {
  id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  isMaster: boolean;
  content: string;
  type: "text" | "poll" | "system" | "share";
  createdAt: string;
  poll?: PollDetail | null;
  payload?: SharePayload | null;
};

/**
 * Garante que o grupo de chat de uma campanha exista e sincroniza seus membros.
 */
export async function ensureCampaignChatGroup(campaignId: string) {
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId)).limit(1);

  if (!campaign) {
    throw new Error("Campanha não encontrada");
  }

  // Busca ou cria o grupo
  let [group] = await db
    .select()
    .from(campaignChatGroups)
    .where(eq(campaignChatGroups.campaignId, campaignId))
    .limit(1);

  if (!group) {
    const [created] = await db
      .insert(campaignChatGroups)
      .values({
        campaignId,
        name: campaign.name,
        avatarUrl: campaign.coverImageUrl || null,
      })
      .returning();
    group = created;
  } else if (group.name !== campaign.name || group.avatarUrl !== campaign.coverImageUrl) {
    const [updated] = await db
      .update(campaignChatGroups)
      .set({
        name: campaign.name,
        avatarUrl: campaign.coverImageUrl || null,
        updatedAt: new Date(),
      })
      .where(eq(campaignChatGroups.id, group.id))
      .returning();
    group = updated;
  }

  // 1. Mestre é sempre admin
  await db
    .insert(campaignChatMembers)
    .values({
      groupId: group.id,
      userId: campaign.masterId,
      role: "admin",
    })
    .onConflictDoUpdate({
      target: [campaignChatMembers.groupId, campaignChatMembers.userId],
      set: { role: "admin" },
    });

  // 2. Busca jogadores com convites ativos
  const inviteUsers = await db
    .select({ userId: campaignInvites.userId })
    .from(campaignInvites)
    .where(
      and(
        eq(campaignInvites.campaignId, campaignId),
        eq(campaignInvites.revoked, false),
        sql`${campaignInvites.userId} IS NOT NULL`,
      ),
    );

  // 3. Busca jogadores que possuem personagens aprovados na campanha
  const characterPlayers = await db
    .select({ ownerId: characters.ownerId })
    .from(characterCampaigns)
    .innerJoin(characters, eq(characterCampaigns.characterId, characters.id))
    .where(
      and(
        eq(characterCampaigns.campaignId, campaignId),
        eq(characterCampaigns.approvalStatus, "approved"),
      ),
    );

  const memberUserIds = new Set<string>();
  for (const inv of inviteUsers) {
    if (inv.userId && inv.userId !== campaign.masterId) memberUserIds.add(inv.userId);
  }
  for (const cp of characterPlayers) {
    if (cp.ownerId && cp.ownerId !== campaign.masterId) memberUserIds.add(cp.ownerId);
  }

  for (const userId of memberUserIds) {
    await db
      .insert(campaignChatMembers)
      .values({
        groupId: group.id,
        userId,
        role: "member",
      })
      .onConflictDoNothing();
  }

  return group;
}

/**
 * Lista todos os grupos de conversa em que o usuário participa.
 */
export async function listUserChatGroups(userId: string): Promise<ChatGroupSummary[]> {
  // Sincroniza lazy grupos para campanhas onde o usuário é mestre
  const masterCampaigns = await db
    .select({ id: campaigns.id })
    .from(campaigns)
    .where(eq(campaigns.masterId, userId));

  for (const c of masterCampaigns) {
    await ensureCampaignChatGroup(c.id);
  }

  // Também sincroniza campanhas onde o usuário possui convite ativo
  const userInvites = await db
    .select({ campaignId: campaignInvites.campaignId })
    .from(campaignInvites)
    .where(and(eq(campaignInvites.userId, userId), eq(campaignInvites.revoked, false)));

  for (const inv of userInvites) {
    await ensureCampaignChatGroup(inv.campaignId);
  }

  // Busca as memberships do usuário
  const memberships = await db
    .select({
      memberId: campaignChatMembers.id,
      groupId: campaignChatMembers.groupId,
      role: campaignChatMembers.role,
      lastReadAt: campaignChatMembers.lastReadAt,
      groupName: campaignChatGroups.name,
      groupAvatar: campaignChatGroups.avatarUrl,
      campaignId: campaignChatGroups.campaignId,
      groupUpdatedAt: campaignChatGroups.updatedAt,
      canRead: campaignChatMembers.canRead,
      canWrite: campaignChatMembers.canWrite,
      canShare: campaignChatMembers.canShare,
      groupType: campaignChatGroups.type,
      userAId: campaignChatGroups.userAId,
      userBId: campaignChatGroups.userBId,
    })
    .from(campaignChatMembers)
    .innerJoin(campaignChatGroups, eq(campaignChatMembers.groupId, campaignChatGroups.id))
    .where(eq(campaignChatMembers.userId, userId));

  if (memberships.length === 0) {
    return [];
  }

  const summaries: ChatGroupSummary[] = [];

  for (const m of memberships) {
    // Conta membros
    const [membersCountRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(campaignChatMembers)
      .where(eq(campaignChatMembers.groupId, m.groupId));

    // Conta não lidas
    const [unreadRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(campaignChatMessages)
      .where(
        and(
          eq(campaignChatMessages.groupId, m.groupId),
          gt(campaignChatMessages.createdAt, m.lastReadAt),
          sql`${campaignChatMessages.senderId} != ${userId}`,
        ),
      );

    // Última mensagem
    const [lastMsg] = await db
      .select({
        id: campaignChatMessages.id,
        content: campaignChatMessages.content,
        type: campaignChatMessages.type,
        createdAt: campaignChatMessages.createdAt,
        senderName: users.displayName,
      })
      .from(campaignChatMessages)
      .innerJoin(users, eq(campaignChatMessages.senderId, users.id))
      .where(eq(campaignChatMessages.groupId, m.groupId))
      .orderBy(desc(campaignChatMessages.createdAt))
      .limit(1);

    let name = m.groupName;
    let avatarUrl = m.groupAvatar;
    let role = m.role as "admin" | "member";

    if (m.groupType === "dm") {
      const otherId = m.userAId === userId ? m.userBId : m.userAId;
      if (otherId) {
        const [other] = await db
          .select({ displayName: users.displayName, masterAvatar: users.masterAvatar })
          .from(users)
          .where(eq(users.id, otherId))
          .limit(1);
        name = other?.displayName || "Usuário";
        avatarUrl = other?.masterAvatar || null;
      }
      role = "member";
    }

    summaries.push({
      id: m.groupId,
      campaignId: m.campaignId,
      type: m.groupType === "dm" ? "dm" : "campaign",
      name,
      avatarUrl,
      role,
      permissions: { canRead: m.canRead, canWrite: m.canWrite, canShare: m.canShare },
      unreadCount: Number(unreadRow?.count ?? 0),
      lastMessage: lastMsg
        ? {
            id: lastMsg.id,
            content: lastMsg.content,
            type: lastMsg.type as "text" | "poll" | "system" | "share",
            createdAt: lastMsg.createdAt.toISOString(),
            senderName: lastMsg.senderName || "Participante",
          }
        : null,
      membersCount: Number(membersCountRow?.count ?? 0),
      updatedAt: (lastMsg?.createdAt || m.groupUpdatedAt).toISOString(),
    });
  }

  // Ordena pelo momento da última atividade decrescente
  return summaries.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

/**
 * Busca ou cria o grupo de DM 1:1 entre dois usuários.
 */
export async function getOrCreateDmGroup(
  userId: string,
  otherUserId: string,
): Promise<ChatGroupSummary> {
  if (userId === otherUserId) {
    throw new Error("Não é possível iniciar um chat consigo mesmo");
  }

  const [other] = await db
    .select({ id: users.id, displayName: users.displayName, masterAvatar: users.masterAvatar })
    .from(users)
    .where(eq(users.id, otherUserId))
    .limit(1);

  if (!other) {
    throw new Error("Usuário não encontrado");
  }

  const [a, b] = userId < otherUserId ? [userId, otherUserId] : [otherUserId, userId];

  let [group] = await db
    .select()
    .from(campaignChatGroups)
    .where(and(eq(campaignChatGroups.userAId, a), eq(campaignChatGroups.userBId, b)))
    .limit(1);

  if (!group) {
    const [created] = await db
      .insert(campaignChatGroups)
      .values({
        campaignId: null,
        type: "dm",
        name: other.displayName || "Chat privado",
        avatarUrl: other.masterAvatar || null,
        userAId: a,
        userBId: b,
      })
      .returning();
    group = created;

    await db.insert(campaignChatMembers).values([
      { groupId: group.id, userId, role: "member" },
      { groupId: group.id, userId: otherUserId, role: "member" },
    ]);
  }

  const all = await listUserChatGroups(userId);
  const found = all.find((g) => g.id === group.id);
  if (!found) {
    throw new Error("Não foi possível carregar a conversa");
  }
  return found;
}

/**
 * Busca histórico de mensagens de um grupo com enquetes enriquecidas.
 */
export async function getGroupMessages(
  groupId: string,
  userId: string,
  limit = 100,
): Promise<ChatMessageDetail[]> {
  // Verifica se é membro
  const [membership] = await db
    .select()
    .from(campaignChatMembers)
    .where(and(eq(campaignChatMembers.groupId, groupId), eq(campaignChatMembers.userId, userId)))
    .limit(1);

  if (!membership) {
    throw new Error("Você não é membro deste grupo");
  }

  if (!membership.canRead) {
    throw new Error("Você não tem permissão para ler este grupo");
  }

  // Busca dados do grupo e mestre
  const [groupWithCampaign] = await db
    .select({
      masterId: campaigns.masterId,
    })
    .from(campaignChatGroups)
    .innerJoin(campaigns, eq(campaignChatGroups.campaignId, campaigns.id))
    .where(eq(campaignChatGroups.id, groupId))
    .limit(1);

  const masterId = groupWithCampaign?.masterId;

  // Busca mensagens
  const messages = await db
    .select({
      id: campaignChatMessages.id,
      groupId: campaignChatMessages.groupId,
      senderId: campaignChatMessages.senderId,
      senderName: users.displayName,
      senderAvatar: users.masterAvatar,
      content: campaignChatMessages.content,
      type: campaignChatMessages.type,
      createdAt: campaignChatMessages.createdAt,
    })
    .from(campaignChatMessages)
    .innerJoin(users, eq(campaignChatMessages.senderId, users.id))
    .where(eq(campaignChatMessages.groupId, groupId))
    .orderBy(desc(campaignChatMessages.createdAt))
    .limit(limit);

  if (messages.length === 0) {
    return [];
  }

  // Busca enquetes vinculadas às mensagens
  const pollMessageIds = messages.filter((m) => m.type === "poll").map((m) => m.id);

  const pollMap = new Map<string, PollDetail>();

  if (pollMessageIds.length > 0) {
    const polls = await db
      .select({
        id: campaignChatPolls.id,
        messageId: campaignChatPolls.messageId,
        title: campaignChatPolls.title,
        isMultipleChoice: campaignChatPolls.isMultipleChoice,
        status: campaignChatPolls.status,
        closedAt: campaignChatPolls.closedAt,
        createdAt: campaignChatPolls.createdAt,
        createdById: campaignChatPolls.createdById,
        createdByName: users.displayName,
      })
      .from(campaignChatPolls)
      .innerJoin(users, eq(campaignChatPolls.createdById, users.id))
      .where(inArray(campaignChatPolls.messageId, pollMessageIds));

    for (const poll of polls) {
      const options = await db
        .select()
        .from(campaignChatPollOptions)
        .where(eq(campaignChatPollOptions.pollId, poll.id))
        .orderBy(campaignChatPollOptions.position);

      const votes = await db
        .select()
        .from(campaignChatPollVotes)
        .where(eq(campaignChatPollVotes.pollId, poll.id));

      const totalVotes = votes.length;
      const userVotedOptionIds = votes.filter((v) => v.userId === userId).map((v) => v.optionId);

      const optionDetails: PollOptionDetail[] = options.map((opt) => {
        const optVotes = votes.filter((v) => v.optionId === opt.id).length;
        const percentage = totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0;
        return {
          id: opt.id,
          text: opt.text,
          position: opt.position,
          votesCount: optVotes,
          percentage,
          hasVoted: userVotedOptionIds.includes(opt.id),
        };
      });

      pollMap.set(poll.messageId, {
        id: poll.id,
        title: poll.title,
        isMultipleChoice: poll.isMultipleChoice,
        status: poll.status as "open" | "closed",
        closedAt: poll.closedAt ? poll.closedAt.toISOString() : null,
        createdAt: poll.createdAt.toISOString(),
        createdById: poll.createdById,
        createdByName: poll.createdByName || "Mestre",
        totalVotes,
        options: optionDetails,
        userVotedOptionIds,
      });
    }
  }

  // Ordena cronologicamente (antigas primeiro) para renderização do chat
  return messages.reverse().map((msg) => ({
    id: msg.id,
    groupId: msg.groupId,
    senderId: msg.senderId,
    senderName: msg.senderName || "Participante",
    senderAvatar: msg.senderAvatar,
    isMaster: msg.senderId === masterId,
    content: msg.content,
    type: msg.type as "text" | "poll" | "system" | "share",
    createdAt: msg.createdAt.toISOString(),
    poll: pollMap.get(msg.id) || null,
  }));
}

/**
 * Envia uma mensagem ou cria uma enquete no grupo.
 */
export async function postChatMessage(
  groupId: string,
  userId: string,
  input: CreateChatMessageInput,
): Promise<ChatMessageDetail> {
  // Verifica se é membro
  const [membership] = await db
    .select({
      id: campaignChatMembers.id,
      role: campaignChatMembers.role,
      canWrite: campaignChatMembers.canWrite,
      canShare: campaignChatMembers.canShare,
      groupName: campaignChatGroups.name,
      campaignId: campaignChatGroups.campaignId,
    })
    .from(campaignChatMembers)
    .innerJoin(campaignChatGroups, eq(campaignChatMembers.groupId, campaignChatGroups.id))
    .where(and(eq(campaignChatMembers.groupId, groupId), eq(campaignChatMembers.userId, userId)))
    .limit(1);

  if (!membership) {
    throw new Error("Você não é membro deste grupo");
  }

  if (!membership.canWrite) {
    throw new Error("Você não tem permissão para escrever neste grupo");
  }

  const campaign = membership.campaignId
    ? (
        await db
          .select({ masterId: campaigns.masterId })
          .from(campaigns)
          .where(eq(campaigns.id, membership.campaignId))
          .limit(1)
      )[0]
    : undefined;

  const isMaster = membership.role === "admin" && campaign?.masterId === userId;

  // Se for enquete, somente Admin/Mestre pode criar
  const isPoll = input.type === "poll" || Boolean(input.poll);
  if (isPoll && !isMaster && membership.role !== "admin") {
    throw new Error("Apenas o Mestre pode criar enquetes");
  }

  const isShare = input.type === "share" || Boolean(input.share);
  if (isShare && !membership.canShare) {
    throw new Error("Você não tem permissão para compartilhar neste grupo");
  }

  const [sender] = await db
    .select({
      displayName: users.displayName,
      masterAvatar: users.masterAvatar,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  let sharePayload: SharePayload | null = null;
  if (isShare && input.share) {
    sharePayload = await buildSharePayload(input.share, userId);
  }

  // Insere a mensagem
  const [createdMessage] = await db
    .insert(campaignChatMessages)
    .values({
      groupId,
      senderId: userId,
      content: input.content,
      type: isPoll ? "poll" : isShare ? "share" : input.type || "text",
      payload: sharePayload,
    })
    .returning();

  // Atualiza updatedAt do grupo e lastReadAt do autor
  await Promise.all([
    db
      .update(campaignChatGroups)
      .set({ updatedAt: new Date() })
      .where(eq(campaignChatGroups.id, groupId)),
    db
      .update(campaignChatMembers)
      .set({ lastReadAt: new Date() })
      .where(and(eq(campaignChatMembers.groupId, groupId), eq(campaignChatMembers.userId, userId))),
  ]);

  let pollDetail: PollDetail | null = null;

  if (isPoll && input.poll) {
    const [newPoll] = await db
      .insert(campaignChatPolls)
      .values({
        messageId: createdMessage.id,
        groupId,
        createdById: userId,
        title: input.poll.title,
        isMultipleChoice: input.poll.isMultipleChoice,
        status: "open",
      })
      .returning();

    const optionsToInsert = input.poll.options.map((text, idx) => ({
      pollId: newPoll.id,
      text,
      position: idx,
    }));

    const insertedOptions = await db
      .insert(campaignChatPollOptions)
      .values(optionsToInsert)
      .returning();

    pollDetail = {
      id: newPoll.id,
      title: newPoll.title,
      isMultipleChoice: newPoll.isMultipleChoice,
      status: "open",
      closedAt: null,
      createdAt: newPoll.createdAt.toISOString(),
      createdById: userId,
      createdByName: sender?.displayName || "Mestre",
      totalVotes: 0,
      options: insertedOptions.map((opt) => ({
        id: opt.id,
        text: opt.text,
        position: opt.position,
        votesCount: 0,
        percentage: 0,
        hasVoted: false,
      })),
      userVotedOptionIds: [],
    };
  }

  return {
    id: createdMessage.id,
    groupId,
    senderId: userId,
    senderName: sender?.displayName || "Participante",
    senderAvatar: sender?.masterAvatar || null,
    isMaster,
    content: createdMessage.content,
    type: createdMessage.type as "text" | "poll" | "system" | "share",
    createdAt: createdMessage.createdAt.toISOString(),
    poll: pollDetail,
    payload: sharePayload,
  };
}

export type GroupMemberDetail = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  role: "admin" | "member";
  canRead: boolean;
  canWrite: boolean;
  canShare: boolean;
  joinedAt: string;
};

/**
 * Lista os membros de um grupo (requer membership).
 */
export async function listGroupMembers(
  groupId: string,
  userId: string,
): Promise<GroupMemberDetail[]> {
  const [membership] = await db
    .select({ id: campaignChatMembers.id })
    .from(campaignChatMembers)
    .where(and(eq(campaignChatMembers.groupId, groupId), eq(campaignChatMembers.userId, userId)))
    .limit(1);

  if (!membership) {
    throw new Error("Você não é membro deste grupo");
  }

  const rows = await db
    .select({
      userId: campaignChatMembers.userId,
      role: campaignChatMembers.role,
      canRead: campaignChatMembers.canRead,
      canWrite: campaignChatMembers.canWrite,
      canShare: campaignChatMembers.canShare,
      joinedAt: campaignChatMembers.joinedAt,
      displayName: users.displayName,
      masterAvatar: users.masterAvatar,
    })
    .from(campaignChatMembers)
    .innerJoin(users, eq(campaignChatMembers.userId, users.id))
    .where(eq(campaignChatMembers.groupId, groupId));

  return rows.map((r) => ({
    userId: r.userId,
    displayName: r.displayName || "Participante",
    avatarUrl: r.masterAvatar,
    role: r.role as "admin" | "member",
    canRead: r.canRead,
    canWrite: r.canWrite,
    canShare: r.canShare,
    joinedAt: r.joinedAt.toISOString(),
  }));
}

async function requireAdmin(groupId: string, actorId: string) {
  const [actor] = await db
    .select({ role: campaignChatMembers.role })
    .from(campaignChatMembers)
    .where(and(eq(campaignChatMembers.groupId, groupId), eq(campaignChatMembers.userId, actorId)))
    .limit(1);

  if (!actor) {
    throw new Error("Você não é membro deste grupo");
  }
  if (actor.role !== "admin") {
    return null;
  }
  return actor;
}

/**
 * Atualiza permissões de um membro (somente admin).
 */
export async function updateMemberPermissions(
  groupId: string,
  actorId: string,
  userId: string,
  input: UpdateMemberPermissionsInput,
): Promise<GroupMemberDetail> {
  const actor = await requireAdmin(groupId, actorId);
  if (!actor) {
    throw new Error("Apenas o Mestre pode alterar permissões");
  }

  const [target] = await db
    .select()
    .from(campaignChatMembers)
    .where(and(eq(campaignChatMembers.groupId, groupId), eq(campaignChatMembers.userId, userId)))
    .limit(1);

  if (!target) {
    throw new Error("Membro não encontrado");
  }
  if (target.role === "admin") {
    throw new Error("Não é possível alterar permissões de um administrador");
  }

  await db
    .update(campaignChatMembers)
    .set({
      ...(input.canRead !== undefined ? { canRead: input.canRead } : {}),
      ...(input.canWrite !== undefined ? { canWrite: input.canWrite } : {}),
      ...(input.canShare !== undefined ? { canShare: input.canShare } : {}),
    })
    .where(and(eq(campaignChatMembers.groupId, groupId), eq(campaignChatMembers.userId, userId)));

  const all = await listGroupMembers(groupId, actorId);
  const detail = all.find((m) => m.userId === userId);
  if (!detail) {
    throw new Error("Membro não encontrado");
  }
  return detail;
}

/**
 * Remove um membro do grupo (somente admin; não remove admins).
 */
export async function removeGroupMember(
  groupId: string,
  actorId: string,
  userId: string,
): Promise<void> {
  const actor = await requireAdmin(groupId, actorId);
  if (!actor) {
    throw new Error("Apenas o Mestre pode remover membros");
  }

  const [target] = await db
    .select()
    .from(campaignChatMembers)
    .where(and(eq(campaignChatMembers.groupId, groupId), eq(campaignChatMembers.userId, userId)))
    .limit(1);

  if (!target) {
    throw new Error("Membro não encontrado");
  }
  if (target.role === "admin") {
    throw new Error("Não é possível remover um administrador");
  }

  await db
    .delete(campaignChatMembers)
    .where(and(eq(campaignChatMembers.groupId, groupId), eq(campaignChatMembers.userId, userId)));
}

/**
 * Remove um usuário da campanha: revoga convite, desvincula personagens
 * e remove do grupo de chat. (Somente o mestre da campanha.)
 */
export async function removeUserFromCampaign(
  campaignId: string,
  masterId: string,
  userId: string,
): Promise<void> {
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId)).limit(1);

  if (!campaign) {
    throw new Error("Campanha não encontrada");
  }
  if (campaign.masterId !== masterId) {
    throw new Error("Apenas o Mestre pode remover usuários da campanha");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(campaignInvites)
      .set({ revoked: true })
      .where(and(eq(campaignInvites.campaignId, campaignId), eq(campaignInvites.userId, userId)));

    const userCharacterIds = tx
      .select({ id: characters.id })
      .from(characters)
      .where(eq(characters.ownerId, userId));

    await tx
      .delete(characterCampaigns)
      .where(
        and(
          eq(characterCampaigns.campaignId, campaignId),
          inArray(characterCampaigns.characterId, userCharacterIds),
        ),
      );

    const [group] = await tx
      .select({ id: campaignChatGroups.id })
      .from(campaignChatGroups)
      .where(eq(campaignChatGroups.campaignId, campaignId))
      .limit(1);

    if (group) {
      await tx
        .delete(campaignChatMembers)
        .where(
          and(eq(campaignChatMembers.groupId, group.id), eq(campaignChatMembers.userId, userId)),
        );
    }
  });
}

/**
 * Monta o snapshot congelado de um compartilhamento (sempre no servidor).
 */
export async function buildSharePayload(input: ShareInput, actorId: string): Promise<SharePayload> {
  if (input.kind === "library_item") {
    const contentType = input.contentType;
    if (!contentType) {
      throw new Error("Conteúdo não encontrado para compartilhar");
    }
    const table = getContentTable(contentType);
    const rows = await db
      .select()
      .from(table)
      .where(
        and(
          eq(getContentIdColumn(contentType), input.id),
          isNull(getContentCampaignColumn(contentType)),
        ),
      )
      .limit(1);
    const row = rows[0] as Record<string, unknown> | undefined;
    if (!row) {
      throw new Error("Conteúdo não encontrado para compartilhar");
    }
    return {
      kind: "library_item",
      snapshot: {
        contentType,
        contentId: input.id,
        name: String(row.name ?? `Conteúdo de ${CONTENT_LABELS[contentType]}`),
        description: typeof row.description === "string" ? row.description : null,
        imageUrl:
          typeof row.imageUrl === "string"
            ? row.imageUrl
            : typeof row.image === "string"
              ? row.image
              : null,
      },
    };
  }

  if (input.kind === "profile") {
    const [user] = await db
      .select({
        id: users.id,
        displayName: users.displayName,
        masterAvatar: users.masterAvatar,
        masterBio: users.masterBio,
      })
      .from(users)
      .where(eq(users.id, input.id))
      .limit(1);
    if (!user) {
      throw new Error("Usuário não encontrado");
    }
    return {
      kind: "profile",
      snapshot: {
        userId: user.id,
        displayName: user.displayName || "Usuário",
        avatarUrl: user.masterAvatar,
        bio: user.masterBio,
      },
    };
  }

  if (input.kind === "post") {
    const [post] = await db
      .select({
        post: communityPosts,
        authorName: users.displayName,
        authorId: users.id,
      })
      .from(communityPosts)
      .innerJoin(users, eq(users.id, communityPosts.authorId))
      .where(eq(communityPosts.id, input.id))
      .limit(1);
    if (!post) {
      throw new Error("Publicação não encontrada");
    }
    return {
      kind: "post",
      snapshot: {
        postId: post.post.id,
        title: post.post.title,
        description: post.post.description,
        contentType: post.post.contentType,
        tags: Array.isArray(post.post.tags) ? (post.post.tags as string[]) : [],
        authorId: post.authorId,
        authorName: post.authorName || "Mestre",
        payload: (post.post.payload ?? {}) as Record<string, unknown>,
      },
    };
  }

  // kind === "campaign"
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, input.id)).limit(1);
  if (!campaign) {
    throw new Error("Campanha não encontrada");
  }
  if (campaign.masterId !== actorId) {
    throw new Error("Apenas o Mestre pode compartilhar acesso à campanha");
  }

  const [master] = await db
    .select({ masterName: users.masterName, displayName: users.displayName })
    .from(users)
    .where(eq(users.id, campaign.masterId))
    .limit(1);

  const [invite] = await db
    .insert(campaignInvites)
    .values({
      campaignId: campaign.id,
      token: generateUrlSafeToken(32),
      revoked: false,
    })
    .returning();

  return {
    kind: "campaign",
    snapshot: {
      campaignId: campaign.id,
      name: campaign.name,
      coverImageUrl: campaign.coverImageUrl,
      inviteToken: invite.token,
      masterName: master?.masterName || master?.displayName || "Mestre",
    },
  };
}

export type ShareCatalog = {
  posts: { id: string; title: string; contentType: string; authorName: string }[];
  campaigns: { id: string; name: string; coverImageUrl: string | null }[];
};

/**
 * Catálogo para o modal de compartilhamento (itens da biblioteca são
 * buscados sob demanda via searchGlobalLibrary).
 */
export async function getShareCatalog(userId: string): Promise<ShareCatalog> {
  const postRows = await db
    .select({
      id: communityPosts.id,
      title: communityPosts.title,
      contentType: communityPosts.contentType,
      authorName: users.displayName,
    })
    .from(communityPosts)
    .innerJoin(users, eq(users.id, communityPosts.authorId))
    .orderBy(desc(communityPosts.createdAt))
    .limit(20);

  const campaignRows = await db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      coverImageUrl: campaigns.coverImageUrl,
    })
    .from(campaigns)
    .where(eq(campaigns.masterId, userId))
    .orderBy(desc(campaigns.createdAt));

  return {
    posts: postRows.map((p) => ({ ...p, authorName: p.authorName || "Mestre" })),
    campaigns: campaignRows,
  };
}

export type LibraryMentionResult = {
  id: string;
  name: string;
  contentType: ContentType;
  description: string | null;
  imageUrl: string | null;
};

/**
 * Busca itens da biblioteca global pelo nome (conteúdo com campaign_id NULL).
 */
export async function searchGlobalLibrary(
  query: string,
  limit = 12,
): Promise<LibraryMentionResult[]> {
  const results: LibraryMentionResult[] = [];

  for (const type of CONTENT_TYPES) {
    const table = getContentTable(type);
    const rows = await db
      .select()
      .from(table)
      .where(
        and(
          ilike(getContentNameColumn(type), `%${query}%`),
          isNull(getContentCampaignColumn(type)),
        ),
      )
      .limit(limit);

    for (const raw of rows) {
      const row = raw as Record<string, unknown>;
      results.push({
        id: String(row.id),
        name: String(row.name ?? "Sem nome"),
        contentType: type,
        description: typeof row.description === "string" ? row.description : null,
        imageUrl:
          typeof row.imageUrl === "string"
            ? row.imageUrl
            : typeof row.image === "string"
              ? row.image
              : null,
      });
    }
  }

  return results.slice(0, limit);
}

export type ChatUserResult = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  isGroupMember: boolean;
};

/**
 * Busca usuários para o autocomplete de @ (membros do grupo primeiro).
 */
export async function searchChatUsers(
  query: string,
  currentUserId: string,
  groupId?: string,
): Promise<ChatUserResult[]> {
  const rows = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      masterAvatar: users.masterAvatar,
    })
    .from(users)
    .where(and(ilike(users.displayName, `%${query}%`), sql`${users.id} != ${currentUserId}`))
    .limit(10);

  let memberIds = new Set<string>();
  if (groupId) {
    const members = await db
      .select({ userId: campaignChatMembers.userId })
      .from(campaignChatMembers)
      .where(eq(campaignChatMembers.groupId, groupId));
    memberIds = new Set(members.map((m) => m.userId));
  }

  return rows
    .map((r) => ({
      userId: r.id,
      displayName: r.displayName || "Usuário",
      avatarUrl: r.masterAvatar,
      isGroupMember: memberIds.has(r.id),
    }))
    .sort((a, b) => Number(b.isGroupMember) - Number(a.isGroupMember));
}

export type ChatMentionResults = {
  users: ChatUserResult[];
  libraryItems: LibraryMentionResult[];
};

/**
 * Busca combinada para o autocomplete de @: usuários e itens da biblioteca global.
 */
export async function searchChatMentions(
  query: string,
  currentUserId: string,
  groupId?: string,
): Promise<ChatMentionResults> {
  const [usersFound, libraryItems] = await Promise.all([
    searchChatUsers(query, currentUserId, groupId),
    searchGlobalLibrary(query),
  ]);

  return { users: usersFound, libraryItems };
}

/**
 * Registra o voto de um usuário em uma enquete.
 */
export async function votePoll(
  pollId: string,
  userId: string,
  optionIds: string[],
): Promise<PollDetail> {
  const [poll] = await db
    .select({
      id: campaignChatPolls.id,
      groupId: campaignChatPolls.groupId,
      title: campaignChatPolls.title,
      isMultipleChoice: campaignChatPolls.isMultipleChoice,
      status: campaignChatPolls.status,
      closedAt: campaignChatPolls.closedAt,
      createdAt: campaignChatPolls.createdAt,
      createdById: campaignChatPolls.createdById,
      createdByName: users.displayName,
    })
    .from(campaignChatPolls)
    .innerJoin(users, eq(campaignChatPolls.createdById, users.id))
    .where(eq(campaignChatPolls.id, pollId))
    .limit(1);

  if (!poll) {
    throw new Error("Enquete não encontrada");
  }

  if (poll.status !== "open") {
    throw new Error("Esta enquete já foi encerrada");
  }

  // Verifica se o usuário é membro do grupo
  const [membership] = await db
    .select()
    .from(campaignChatMembers)
    .where(
      and(eq(campaignChatMembers.groupId, poll.groupId), eq(campaignChatMembers.userId, userId)),
    )
    .limit(1);

  if (!membership) {
    throw new Error("Você não é membro do grupo desta enquete");
  }

  const validOptions = await db
    .select()
    .from(campaignChatPollOptions)
    .where(eq(campaignChatPollOptions.pollId, pollId));

  const validOptionIdSet = new Set(validOptions.map((o) => o.id));
  const filteredOptionIds = optionIds.filter((id) => validOptionIdSet.has(id));

  if (filteredOptionIds.length === 0) {
    throw new Error("Nenhuma opção válida selecionada");
  }

  const finalOptionIds = poll.isMultipleChoice ? filteredOptionIds : [filteredOptionIds[0]];

  // Transação: remove votos anteriores do usuário e insere novos
  await db.transaction(async (tx) => {
    await tx
      .delete(campaignChatPollVotes)
      .where(
        and(eq(campaignChatPollVotes.pollId, pollId), eq(campaignChatPollVotes.userId, userId)),
      );

    await tx.insert(campaignChatPollVotes).values(
      finalOptionIds.map((optionId) => ({
        pollId,
        optionId,
        userId,
      })),
    );
  });

  // Recarrega todos os votos para recalcular o estado atualizado
  const allVotes = await db
    .select()
    .from(campaignChatPollVotes)
    .where(eq(campaignChatPollVotes.pollId, pollId));

  const totalVotes = allVotes.length;

  const optionDetails: PollOptionDetail[] = validOptions
    .sort((a, b) => a.position - b.position)
    .map((opt) => {
      const optVotes = allVotes.filter((v) => v.optionId === opt.id).length;
      const percentage = totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0;
      return {
        id: opt.id,
        text: opt.text,
        position: opt.position,
        votesCount: optVotes,
        percentage,
        hasVoted: finalOptionIds.includes(opt.id),
      };
    });

  return {
    id: poll.id,
    title: poll.title,
    isMultipleChoice: poll.isMultipleChoice,
    status: poll.status as "open" | "closed",
    closedAt: poll.closedAt ? poll.closedAt.toISOString() : null,
    createdAt: poll.createdAt.toISOString(),
    createdById: poll.createdById,
    createdByName: poll.createdByName || "Mestre",
    totalVotes,
    options: optionDetails,
    userVotedOptionIds: finalOptionIds,
  };
}

/**
 * Encerra uma enquete ativa (apenas criador ou admin).
 */
export async function closePoll(pollId: string, userId: string): Promise<PollDetail> {
  const [poll] = await db
    .select({
      id: campaignChatPolls.id,
      groupId: campaignChatPolls.groupId,
      title: campaignChatPolls.title,
      isMultipleChoice: campaignChatPolls.isMultipleChoice,
      status: campaignChatPolls.status,
      closedAt: campaignChatPolls.closedAt,
      createdAt: campaignChatPolls.createdAt,
      createdById: campaignChatPolls.createdById,
      createdByName: users.displayName,
    })
    .from(campaignChatPolls)
    .innerJoin(users, eq(campaignChatPolls.createdById, users.id))
    .where(eq(campaignChatPolls.id, pollId))
    .limit(1);

  if (!poll) {
    throw new Error("Enquete não encontrada");
  }

  // Verifica permissão (criador ou admin)
  const [membership] = await db
    .select({ role: campaignChatMembers.role })
    .from(campaignChatMembers)
    .where(
      and(eq(campaignChatMembers.groupId, poll.groupId), eq(campaignChatMembers.userId, userId)),
    )
    .limit(1);

  if (poll.createdById !== userId && membership?.role !== "admin") {
    throw new Error("Apenas o Mestre pode encerrar a enquete");
  }

  const [closed] = await db
    .update(campaignChatPolls)
    .set({
      status: "closed",
      closedAt: new Date(),
    })
    .where(eq(campaignChatPolls.id, pollId))
    .returning();

  const options = await db
    .select()
    .from(campaignChatPollOptions)
    .where(eq(campaignChatPollOptions.pollId, pollId))
    .orderBy(campaignChatPollOptions.position);

  const votes = await db
    .select()
    .from(campaignChatPollVotes)
    .where(eq(campaignChatPollVotes.pollId, pollId));

  const totalVotes = votes.length;
  const userVotedOptionIds = votes.filter((v) => v.userId === userId).map((v) => v.optionId);

  return {
    id: closed.id,
    title: closed.title,
    isMultipleChoice: closed.isMultipleChoice,
    status: "closed",
    closedAt: closed.closedAt ? closed.closedAt.toISOString() : null,
    createdAt: closed.createdAt.toISOString(),
    createdById: closed.createdById,
    createdByName: poll.createdByName || "Mestre",
    totalVotes,
    options: options.map((opt) => {
      const optVotes = votes.filter((v) => v.optionId === opt.id).length;
      const percentage = totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0;
      return {
        id: opt.id,
        text: opt.text,
        position: opt.position,
        votesCount: optVotes,
        percentage,
        hasVoted: userVotedOptionIds.includes(opt.id),
      };
    }),
    userVotedOptionIds,
  };
}

/**
 * Marca mensagens de um grupo como lidas para o usuário.
 */
export async function markGroupAsRead(groupId: string, userId: string) {
  await db
    .update(campaignChatMembers)
    .set({ lastReadAt: new Date() })
    .where(and(eq(campaignChatMembers.groupId, groupId), eq(campaignChatMembers.userId, userId)));
}
