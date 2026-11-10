"use client";

import React, { useEffect, useState } from "react";
import { MoreHorizontal, Settings, Shield, Users, UserMinus, X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import type {
  ChatGroupSummary,
  GroupMemberDetail,
  MemberPermissions,
} from "@/lib/server/chat-service";

type ChatSettingsPanelProps = {
  group: ChatGroupSummary;
  currentUserId: string;
  onClose: () => void;
  onPermissionsChanged: (userId: string, perms: MemberPermissions) => void;
  onMemberRemoved: (userId: string, reason: "group" | "campaign") => void;
};

type ConfirmingState = { userId: string; action: "group" | "campaign" } | null;

const PERMISSION_FLAGS: { flag: keyof MemberPermissions; label: string }[] = [
  { flag: "canRead", label: "Ler" },
  { flag: "canWrite", label: "Escrever" },
  { flag: "canShare", label: "Compartilhar" },
];

function describeRestriction(member: GroupMemberDetail): string | null {
  if (!member.canRead) return "Somente leitura";
  if (!member.canWrite) return "Sem escrita";
  if (!member.canShare) return "Sem compartilhamento";
  return null;
}

export function ChatSettingsPanel({
  group,
  currentUserId,
  onClose,
  onPermissionsChanged,
  onMemberRemoved,
}: ChatSettingsPanelProps) {
  const [members, setMembers] = useState<GroupMemberDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<ConfirmingState>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [menuUserId, setMenuUserId] = useState<string | null>(null);

  const isAdmin = group.role === "admin";
  const isCampaignGroup = group.type === "campaign" && Boolean(group.campaignId);

  useEffect(() => {
    let cancelled = false;
    const loadMembers = async () => {
      try {
        const res = await fetch(`/api/chat/groups/${group.id}/members`, {
          credentials: "include",
        });
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && data.success) {
          setMembers(data.data as GroupMemberDetail[]);
        } else {
          setError(typeof data.error === "string" ? data.error : "Erro ao carregar membros");
        }
      } catch {
        if (!cancelled) setError("Erro ao carregar membros");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadMembers();
    return () => {
      cancelled = true;
    };
  }, [group.id]);

  const handleTogglePermission = async (
    member: GroupMemberDetail,
    flag: keyof MemberPermissions,
  ) => {
    if (!isAdmin || busyUserId) return;
    setBusyUserId(member.userId);
    setError(null);
    try {
      const res = await fetch(`/api/chat/groups/${group.id}/members/${member.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [flag]: !member[flag] }),
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        const updated = data.data as GroupMemberDetail;
        setMembers((prev) => prev.map((m) => (m.userId === updated.userId ? updated : m)));
        onPermissionsChanged(updated.userId, {
          canRead: updated.canRead,
          canWrite: updated.canWrite,
          canShare: updated.canShare,
        });
      } else {
        setError(typeof data.error === "string" ? data.error : "Erro ao atualizar permissão");
      }
    } catch {
      setError("Erro ao atualizar permissão");
    } finally {
      setBusyUserId(null);
    }
  };

  const executeRemoval = async (userId: string, action: "group" | "campaign") => {
    if (busyUserId) return;
    setBusyUserId(userId);
    setError(null);
    try {
      const res =
        action === "group"
          ? await fetch(`/api/chat/groups/${group.id}/members/${userId}`, {
              method: "DELETE",
              credentials: "include",
            })
          : await fetch(`/api/campaigns/${group.campaignId}/remove-member`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId }),
              credentials: "include",
            });
      const data = await res.json();
      if (res.ok && data.success) {
        setMembers((prev) => prev.filter((m) => m.userId !== userId));
        setConfirming(null);
        setMenuUserId(null);
        onMemberRemoved(userId, action);
      } else {
        setError(typeof data.error === "string" ? data.error : "Erro ao remover membro");
      }
    } catch {
      setError("Erro ao remover membro");
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      ariaLabel="Configurações do grupo"
      className="mx-auto max-w-lg overflow-hidden rounded-2xl border border-secondary-border bg-secondary-card shadow-2xl"
    >
      <Modal.Header className="flex items-center justify-between border-b border-secondary-border bg-dominant-deep/60 px-5 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-accent/30 bg-accent/15 text-accent">
            <Settings className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-secondary-pure truncate">
              Configurações do grupo
            </h3>
            <p className="text-[11px] text-secondary-muted truncate">
              Gerencie participantes e permissões de conversa
            </p>
          </div>
        </div>
        <Modal.CloseButton className="rounded-lg p-1.5 text-secondary-muted hover:text-secondary-pure hover:bg-secondary-input transition-colors cursor-pointer" />
      </Modal.Header>

      <Modal.Body className="flex flex-col gap-4 p-5 overflow-y-auto max-h-[72vh]">
        {/* Card resumo do grupo */}
        <div className="flex items-center gap-3.5 rounded-xl border border-secondary-border bg-dominant-deep/50 p-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-secondary-border bg-secondary-card">
            {group.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={group.avatarUrl} alt={group.name} className="h-full w-full object-cover" />
            ) : (
              <span className="text-sm font-black text-accent">
                {group.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="truncate text-sm font-bold text-secondary-pure">{group.name}</h4>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-secondary-muted">
              <Users className="h-3.5 w-3.5 text-accent" />
              <span>
                {group.name} · {members.length} participante{members.length === 1 ? "" : "s"}
              </span>
            </p>
          </div>
          {isAdmin && (
            <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/15 px-2.5 py-1 text-[10px] font-bold text-accent shrink-0">
              <Shield className="h-3 w-3" />
              Admin
            </span>
          )}
        </div>

        {error && (
          <div className="rounded-xl bg-red-950/80 border border-red-800/80 px-3.5 py-2.5 text-xs text-red-300">
            {error}
          </div>
        )}

        {loading && (
          <div
            className="flex items-center justify-center rounded-xl border border-secondary-border/60 bg-dominant-deep/30 py-8 text-xs text-secondary-muted"
            data-testid="members-loading"
          >
            Carregando membros...
          </div>
        )}

        {!loading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-secondary-muted">
                Participantes ({members.length})
              </span>
              {isAdmin && (
                <span className="text-[10px] text-secondary-muted">
                  Clique nas permissões para alternar
                </span>
              )}
            </div>

            <ul className="flex flex-col gap-2.5">
              {members.map((member) => {
                const isSelf = member.userId === currentUserId;
                const isTargetAdmin = member.role === "admin";
                const canManage = isAdmin && !isTargetAdmin && !isSelf;
                const isConfirming = confirming?.userId === member.userId;
                const restriction = describeRestriction(member);

                return (
                  <li
                    key={member.userId}
                    data-testid={`member-row-${member.userId}`}
                    className="flex flex-col gap-3 rounded-xl border border-secondary-border bg-dominant-deep/40 p-3.5 transition-colors hover:border-secondary-border/90"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary-card border border-secondary-border">
                        {member.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={member.avatarUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-xs font-bold text-accent">
                            {member.displayName.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate text-xs font-bold text-secondary-pure">
                            {member.displayName}
                          </span>
                          {isTargetAdmin && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-accent">
                              <Shield className="h-2.5 w-2.5" />
                              Mestre
                            </span>
                          )}
                          {isSelf && (
                            <span className="rounded-full bg-secondary-input px-2 py-0.5 text-[10px] font-medium text-secondary-muted">
                              (você)
                            </span>
                          )}
                        </div>
                        {!isAdmin && restriction && (
                          <span className="mt-1 inline-block rounded-md border border-secondary-border bg-secondary-input px-2 py-0.5 text-[10px] font-semibold text-secondary-muted">
                            {restriction}
                          </span>
                        )}
                      </div>

                      {canManage && (
                        <div className="relative shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setMenuUserId((prev) =>
                                prev === member.userId ? null : member.userId,
                              )
                            }
                            data-testid={`member-actions-${member.userId}`}
                            aria-label={`Ações para ${member.displayName}`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-secondary-muted hover:border-secondary-border hover:bg-secondary-input hover:text-secondary-pure transition-colors cursor-pointer"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                          {menuUserId === member.userId && (
                            <div className="absolute right-0 top-full z-20 mt-1.5 w-52 overflow-hidden rounded-xl border border-secondary-border bg-secondary-card p-1 shadow-xl">
                              <button
                                type="button"
                                onClick={() => {
                                  setMenuUserId(null);
                                  setConfirming({ userId: member.userId, action: "group" });
                                }}
                                data-testid={`remove-from-group-${member.userId}`}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-secondary-pure hover:bg-secondary-input transition-colors cursor-pointer"
                              >
                                <UserMinus className="h-3.5 w-3.5 text-secondary-muted" />
                                Remover do grupo
                              </button>
                              {isCampaignGroup && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMenuUserId(null);
                                    setConfirming({ userId: member.userId, action: "campaign" });
                                  }}
                                  data-testid={`remove-from-campaign-${member.userId}`}
                                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-950/40 transition-colors cursor-pointer"
                                >
                                  <X className="h-3.5 w-3.5" />
                                  Remover da campanha
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-secondary-border/60 pt-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {PERMISSION_FLAGS.map(({ flag, label }) => {
                          const active = member[flag];
                          const disabled = !canManage || busyUserId === member.userId;
                          return (
                            <label
                              key={flag}
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                                active
                                  ? "border-accent/40 bg-accent/15 text-secondary-pure"
                                  : "border-secondary-border bg-secondary-input/50 text-secondary-muted"
                              } ${disabled ? "opacity-65 cursor-default" : "cursor-pointer hover:border-accent"}`}
                            >
                              <input
                                type="checkbox"
                                data-testid={`perm-${flag}-${member.userId}`}
                                checked={active}
                                disabled={disabled}
                                onChange={() => void handleTogglePermission(member, flag)}
                                className="h-3.5 w-3.5 rounded border-secondary-border bg-secondary-input accent-accent"
                              />
                              {label}
                            </label>
                          );
                        })}
                      </div>

                      {isConfirming && (
                        <div className="flex items-center gap-1.5 ml-auto">
                          <button
                            type="button"
                            onClick={() => setConfirming(null)}
                            className="rounded-lg border border-secondary-border bg-secondary-input px-2.5 py-1 text-[10px] font-semibold text-secondary-muted hover:text-secondary-pure transition-colors cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void executeRemoval(member.userId, confirming?.action ?? "group")
                            }
                            disabled={busyUserId === member.userId}
                            data-testid={`confirm-remove-${member.userId}`}
                            className="rounded-lg border border-red-800/80 bg-red-950/60 px-2.5 py-1 text-[10px] font-semibold text-red-300 hover:bg-red-900/60 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {busyUserId === member.userId ? "Removendo..." : "Confirmar remoção?"}
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Modal.Body>
    </Modal>
  );
}
