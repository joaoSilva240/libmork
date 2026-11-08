import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CampaignChat } from "../CampaignChat";

vi.mock("@/context/SocketContext", () => ({
  useSocket: () => ({
    joinChatGroup: vi.fn(),
    leaveChatGroup: vi.fn(),
    sendChatMessage: vi.fn(),
    sendChatPollVote: vi.fn(),
    sendChatPollClose: vi.fn(),
    sendChatMemberUpdated: vi.fn(),
    sendChatMemberRemoved: vi.fn(),
    subscribeChatMessage: () => () => {},
    subscribeChatPollUpdated: () => () => {},
    subscribeChatPollClosed: () => () => {},
    subscribeChatMemberUpdated: () => () => {},
    subscribeChatMemberRemoved: () => () => {},
  }),
}));

describe("CampaignChat (Issue #62)", () => {
  const mockGroups = [
    {
      id: "group-1",
      campaignId: "camp-1",
      type: "campaign" as const,
      name: "Maldição de Strahd",
      avatarUrl: null,
      role: "admin" as const,
      permissions: { canRead: true, canWrite: true, canShare: true },
      unreadCount: 2,
      lastMessage: {
        id: "msg-1",
        content: "Bem-vindos a Barovia",
        type: "text" as const,
        createdAt: new Date().toISOString(),
        senderName: "Mestre",
      },
      membersCount: 4,
      updatedAt: new Date().toISOString(),
    },
    {
      id: "group-2",
      campaignId: "camp-2",
      type: "campaign" as const,
      name: "Mina Perdida",
      avatarUrl: null,
      role: "member" as const,
      permissions: { canRead: true, canWrite: true, canShare: true },
      unreadCount: 3,
      lastMessage: null,
      membersCount: 3,
      updatedAt: new Date().toISOString(),
    },
  ];

  const mockMessages = [
    {
      id: "msg-1",
      groupId: "group-1",
      senderId: "user-master",
      senderName: "Mestre",
      senderAvatar: null,
      isMaster: true,
      content: "Bem-vindos a Barovia",
      type: "text" as const,
      createdAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/chat/groups") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: mockGroups }),
        });
      }
      if (url.includes("/messages")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: mockMessages }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
    });
  });

  it("renderiza a lista de grupos de campanha e seleciona o primeiro por padrão", async () => {
    render(
      <CampaignChat
        currentUser={{
          id: "user-master",
          displayName: "Mestre Supremo",
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByText("Maldição de Strahd").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Mina Perdida")).toBeInTheDocument();
      expect(screen.getByText("Bem-vindos a Barovia")).toBeInTheDocument();
    });

    expect(screen.getByTestId("unread-badge-group-2")).toHaveTextContent("3");
  });

  it("permite filtrar conversas pelo campo de pesquisa", async () => {
    render(
      <CampaignChat
        currentUser={{
          id: "user-master",
          displayName: "Mestre Supremo",
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByText("Maldição de Strahd").length).toBeGreaterThanOrEqual(1);
    });

    const searchInput = screen.getByPlaceholderText("Pesquisar conversas...");
    fireEvent.change(searchInput, { target: { value: "Strahd" } });

    expect(screen.getAllByText("Maldição de Strahd").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Mina Perdida")).not.toBeInTheDocument();
  });

  it("troca de grupo ao clicar em outro item da lista", async () => {
    render(
      <CampaignChat
        currentUser={{
          id: "user-master",
          displayName: "Mestre Supremo",
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Mina Perdida")).toBeInTheDocument();
    });

    const group2Item = screen.getByTestId("chat-group-item-group-2");
    fireEvent.click(group2Item);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/chat/groups/group-2/messages",
        expect.anything(),
      );
    });
  });
});
