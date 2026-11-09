"use client";

import React, { useEffect, useState } from "react";
import { MoreHorizontal, Settings, X } from "lucide-react";
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
      className="max-w-md bg-secondary-card border border-secondary-border rounded-xl"
    >
      <Modal.Header className="flex items-center justify-between border-b border-secondary-border p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/20 text-accent">
            <Settings className="h-4 w-4" />
          </div>
          <h3 className="text-base font-bold text-secondary-pure">Configurações do grupo</h3>
        </div>
        <Modal.CloseButton className="rounded p-1.5 text-secondary-muted hover:text-secondary-pure hover:bg-secondary-input transition-colors cursor-pointer" />
      </Modal.Header>

      <Modal.Body className="flex flex-col gap-3 p-4 overflow-y-auto max-h-[70vh]">
        <p className="text-xs font-semibold text-secondary-muted">
          {group.name} · {members.length} participante{members.length === 1 ? "" : "s"}
        </p>

        {error && (
          <div className="rounded-lg bg-red-950/80 border border-red-800 p-2.5 text-xs text-red-400">
            {error}
          </div>
        )}

        {loading && (
          <p className="text-xs text-secondary-muted" data-testid="members-loading">
            Carregando membros...
          </p>
        )}

        <ul className="flex flex-col gap-2">
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
                className="flex flex-col gap-2 rounded-lg border border-secondary-border bg-secondary-input/40 p-2.5"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-dominant-deep border border-secondary-border">
                    {member.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={member.avatarUrl} alt="" className="h-full w-full object-cover" />
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
                        <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-accent">
                          Mestre
                        </span>
                      )}
                      {isSelf && <span className="text-[10px] text-secondary-muted">(você)</span>}
                    </div>
                    {!isAdmin && restriction && (
                      <span className="mt-0.5 inline-block rounded bg-secondary-input px-1.5 py-0.5 text-[9px] font-semibold text-secondary-muted">
                        {restriction}
                      </span>
                    )}
                  </div>

                  {canManage && (
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setMenuUserId((prev) => (prev === member.userId ? null : member.userId))
                        }
                        data-testid={`member-actions-${member.userId}`}
                        aria-label={`Ações para ${member.displayName}`}
                        className="rounded p-1.5 text-secondary-muted hover:text-secondary-pure hover:bg-secondary-input transition-colors cursor-pointer"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {menuUserId === member.userId && (
                        <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-secondary-border bg-secondary-card shadow-lg">
                          <button
                            type="button"
                            onClick={() => {
                              setMenuUserId(null);
                              setConfirming({ userId: member.userId, action: "group" });
                            }}
                            data-testid={`remove-from-group-${member.userId}`}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-secondary-pure hover:bg-secondary-input transition-colors cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5" /> Remover do grupo
                          </button>
                          {isCampaignGroup && (
                            <button
                              type="button"
                              onClick={() => {
                                setMenuUserId(null);
                                setConfirming({ userId: member.userId, action: "campaign" });
                              }}
                              data-testid={`remove-from-campaign-${member.userId}`}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-red-400 hover:bg-secondary-input transition-colors cursor-pointer"
                            >
                              <X className="h-3.5 w-3.5" /> Remover da campanha
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {PERMISSION_FLAGS.map(({ flag, label }) => (
                    <label
                      key={flag}
                      className="flex items-center gap-1 text-[10px] font-medium text-secondary-muted"
                    >
                      <input
                        type="checkbox"
                        data-testid={`perm-${flag}-${member.userId}`}
                        checked={member[flag]}
                        disabled={!canManage || busyUserId === member.userId}
                        onChange={() => void handleTogglePermission(member, flag)}
                        className="h-3 w-3 rounded border-secondary-border bg-secondary-input accent-accent"
                      />
                      {label}
                    </label>
                  ))}

                  {isConfirming && (
                    <button
                      type="button"
                      onClick={() =>
                        void executeRemoval(member.userId, confirming?.action ?? "group")
                      }
                      disabled={busyUserId === member.userId}
                      data-testid={`confirm-remove-${member.userId}`}
                      className="ml-auto rounded border border-red-800/80 bg-red-950/40 px-2 py-1 text-[10px] font-semibold text-red-400 hover:bg-red-900/50 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {busyUserId === member.userId ? "Removendo..." : "Confirmar remoção?"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Modal.Body>
    </Modal>
  );
}
