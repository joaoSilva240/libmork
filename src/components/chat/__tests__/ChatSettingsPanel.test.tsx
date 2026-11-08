import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ChatSettingsPanel } from "../ChatSettingsPanel";
import type { ChatGroupSummary, GroupMemberDetail } from "@/lib/server/chat-service";

const membersFixture: GroupMemberDetail[] = [
  {
    userId: "u-1",
    displayName: "João",
    avatarUrl: null,
    role: "admin",
    canRead: true,
    canWrite: true,
    canShare: true,
    joinedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    userId: "u-2",
    displayName: "Maria",
    avatarUrl: null,
    role: "member",
    canRead: true,
    canWrite: true,
    canShare: true,
    joinedAt: "2026-01-02T00:00:00.000Z",
  },
];

function makeGroup(overrides: Partial<ChatGroupSummary> = {}): ChatGroupSummary {
  return {
    id: "group-1",
    campaignId: "c-1",
    type: "campaign",
    name: "Maldição de Strahd",
    avatarUrl: null,
    role: "admin",
    permissions: { canRead: true, canWrite: true, canShare: true },
    unreadCount: 0,
    lastMessage: null,
    membersCount: 2,
    updatedAt: "2026-01-03T00:00:00.000Z",
    ...overrides,
  };
}

function jsonResponse(body: unknown, ok = true) {
  return Promise.resolve({
    ok,
    status: ok ? 200 : 403,
    json: () => Promise.resolve(body),
  });
}

describe("ChatSettingsPanel (Issue #62)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (method === "GET" && url === "/api/chat/groups/group-1/members") {
        return jsonResponse({ success: true, data: membersFixture });
      }
      if (method === "PATCH" && url === "/api/chat/groups/group-1/members/u-2") {
        return jsonResponse({
          success: true,
          data: { ...membersFixture[1], canWrite: false },
        });
      }
      if (method === "DELETE" && url === "/api/chat/groups/group-1/members/u-2") {
        return jsonResponse({ success: true });
      }
      if (method === "POST" && url === "/api/campaigns/c-1/remove-member") {
        return jsonResponse({ success: true });
      }
      return jsonResponse({ success: true });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renderiza a lista de membros com nomes e badge Mestre para o admin", async () => {
    render(
      <ChatSettingsPanel
        group={makeGroup()}
        currentUserId="u-1"
        onClose={vi.fn()}
        onPermissionsChanged={vi.fn()}
        onMemberRemoved={vi.fn()}
      />,
    );

    expect(await screen.findByText("Maria")).toBeInTheDocument();
    expect(screen.getByText("João")).toBeInTheDocument();
    expect(screen.getByText("(você)")).toBeInTheDocument();
    expect(screen.getAllByText("Mestre").length).toBeGreaterThanOrEqual(1);
  });

  it("admin toggla Escrever de Maria: PATCH com canWrite false e onPermissionsChanged", async () => {
    const onPermissionsChanged = vi.fn();
    render(
      <ChatSettingsPanel
        group={makeGroup()}
        currentUserId="u-1"
        onClose={vi.fn()}
        onPermissionsChanged={onPermissionsChanged}
        onMemberRemoved={vi.fn()}
      />,
    );

    await screen.findByText("Maria");
    fireEvent.click(screen.getByTestId("perm-canWrite-u-2"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/chat/groups/group-1/members/u-2",
        expect.objectContaining({
          method: "PATCH",
          credentials: "include",
          body: JSON.stringify({ canWrite: false }),
        }),
      );
    });

    await waitFor(() => {
      expect(onPermissionsChanged).toHaveBeenCalledWith("u-2", {
        canRead: true,
        canWrite: false,
        canShare: true,
      });
    });
  });

  it("remove do grupo em dois passos: DELETE e onMemberRemoved com reason group", async () => {
    const onMemberRemoved = vi.fn();
    render(
      <ChatSettingsPanel
        group={makeGroup()}
        currentUserId="u-1"
        onClose={vi.fn()}
        onPermissionsChanged={vi.fn()}
        onMemberRemoved={onMemberRemoved}
      />,
    );

    await screen.findByText("Maria");
    fireEvent.click(screen.getByTestId("member-actions-u-2"));
    fireEvent.click(screen.getByTestId("remove-from-group-u-2"));

    const confirmBtn = await screen.findByTestId("confirm-remove-u-2");
    expect(confirmBtn).toHaveTextContent("Confirmar remoção?");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/chat/groups/group-1/members/u-2",
        expect.objectContaining({ method: "DELETE", credentials: "include" }),
      );
    });

    await waitFor(() => {
      expect(onMemberRemoved).toHaveBeenCalledWith("u-2", "group");
    });
    expect(screen.queryByText("Maria")).not.toBeInTheDocument();
  });

  it("remove da campanha: POST remove-member e onMemberRemoved com reason campaign", async () => {
    const onMemberRemoved = vi.fn();
    render(
      <ChatSettingsPanel
        group={makeGroup({ campaignId: "c-1", type: "campaign" })}
        currentUserId="u-1"
        onClose={vi.fn()}
        onPermissionsChanged={vi.fn()}
        onMemberRemoved={onMemberRemoved}
      />,
    );

    await screen.findByText("Maria");
    fireEvent.click(screen.getByTestId("member-actions-u-2"));
    fireEvent.click(screen.getByTestId("remove-from-campaign-u-2"));

    const confirmBtn = await screen.findByTestId("confirm-remove-u-2");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/campaigns/c-1/remove-member",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: JSON.stringify({ userId: "u-2" }),
        }),
      );
    });

    await waitFor(() => {
      expect(onMemberRemoved).toHaveBeenCalledWith("u-2", "campaign");
    });
  });

  it("não-admin: toggles desabilitados e sem botões de remoção", async () => {
    render(
      <ChatSettingsPanel
        group={makeGroup({ role: "member" })}
        currentUserId="u-2"
        onClose={vi.fn()}
        onPermissionsChanged={vi.fn()}
        onMemberRemoved={vi.fn()}
      />,
    );

    await screen.findByText("Maria");

    expect(screen.getByTestId("perm-canWrite-u-2")).toBeDisabled();
    expect(screen.getByTestId("perm-canRead-u-1")).toBeDisabled();
    expect(screen.queryByTestId("member-actions-u-2")).not.toBeInTheDocument();
    expect(screen.queryByTestId("remove-from-group-u-2")).not.toBeInTheDocument();
    expect(screen.queryByTestId("remove-from-campaign-u-2")).not.toBeInTheDocument();
  });
});
