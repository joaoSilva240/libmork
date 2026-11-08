import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ActiveChatRoom } from "../ActiveChatRoom";
import type { ChatGroupSummary } from "@/lib/server/chat-service";

const mockGroup: ChatGroupSummary = {
  id: "group-1",
  campaignId: "camp-1",
  type: "campaign",
  name: "Maldição de Strahd",
  avatarUrl: null,
  role: "member",
  permissions: { canRead: true, canWrite: true, canShare: true },
  unreadCount: 0,
  lastMessage: null,
  membersCount: 3,
  updatedAt: new Date().toISOString(),
};

const mentionSearch = {
  success: true,
  data: {
    users: [
      {
        userId: "u-9",
        displayName: "Maria Silveira",
        avatarUrl: null,
        isGroupMember: true,
      },
    ],
    libraryItems: [
      {
        id: "s-1",
        name: "Bola de Fogo",
        contentType: "spells",
        description: null,
        imageUrl: null,
      },
    ],
  },
};

function renderRoom(onSendShare = vi.fn().mockResolvedValue(undefined)) {
  render(
    <ActiveChatRoom
      group={mockGroup}
      messages={[]}
      currentUserId="u-1"
      onSendMessage={vi.fn().mockResolvedValue(undefined)}
      onCreatePoll={vi.fn().mockResolvedValue(undefined)}
      onVotePoll={vi.fn().mockResolvedValue(undefined)}
      onClosePoll={vi.fn().mockResolvedValue(undefined)}
      onSendShare={onSendShare}
      onOpenSettings={vi.fn()}
    />,
  );
  return onSendShare;
}

describe("ActiveChatRoom — autocomplete de @ (Task 9)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/chat/search")) {
          return Promise.resolve({ ok: true, json: () => Promise.resolve(mentionSearch) });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("envia share de perfil ao selecionar menção de usuário", async () => {
    const onSendShare = renderRoom();
    const textarea = screen.getByTestId("chat-input-textarea");
    fireEvent.change(textarea, { target: { value: "Oi @mar" } });

    const option = await screen.findByText("Maria Silveira");
    expect(screen.getByTestId("mention-dropdown")).toBeInTheDocument();
    fireEvent.click(option);

    expect(onSendShare).toHaveBeenCalledWith({ kind: "profile", id: "u-9" }, "Oi");
    expect((textarea as HTMLTextAreaElement).value).toBe("");
  });

  it("envia share de item da biblioteca ao selecionar menção de item", async () => {
    const onSendShare = renderRoom();
    const textarea = screen.getByTestId("chat-input-textarea");
    fireEvent.change(textarea, { target: { value: "Olha @bola" } });

    const option = await screen.findByText("Bola de Fogo");
    fireEvent.click(option);

    expect(onSendShare).toHaveBeenCalledWith(
      { kind: "library_item", id: "s-1", contentType: "spells" },
      "Olha",
    );
  });

  it("chama a busca com q e groupId após debounce", async () => {
    renderRoom();
    const textarea = screen.getByTestId("chat-input-textarea");
    fireEvent.change(textarea, { target: { value: "Oi @mar" } });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/chat/search?q=mar&groupId=group-1",
        expect.objectContaining({ credentials: "include" }),
      );
    });
  });

  it("não abre dropdown sem o mínimo de 3 caracteres após @", async () => {
    renderRoom();
    const textarea = screen.getByTestId("chat-input-textarea");
    fireEvent.change(textarea, { target: { value: "Oi @ma" } });

    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(screen.queryByTestId("mention-dropdown")).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/chat/search"),
      expect.anything(),
    );
  });

  it("seleciona o primeiro resultado com Enter e fecha com Escape", async () => {
    const onSendShare = renderRoom();
    const textarea = screen.getByTestId("chat-input-textarea");
    fireEvent.change(textarea, { target: { value: "@mar" } });
    await screen.findByText("Maria Silveira");

    fireEvent.keyDown(textarea, { key: "Escape" });
    expect(screen.queryByTestId("mention-dropdown")).not.toBeInTheDocument();

    fireEvent.change(textarea, { target: { value: "@" } });
    fireEvent.change(textarea, { target: { value: "@mar" } });
    await screen.findByText("Maria Silveira");
    fireEvent.keyDown(textarea, { key: "Enter" });

    expect(onSendShare).toHaveBeenCalledWith(
      { kind: "profile", id: "u-9" },
      "Perfil compartilhado",
    );
  });
});
