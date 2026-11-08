import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ShareDetailModal } from "../ShareDetailModal";
import type { SharePayload } from "@/lib/server/chat-service";

const postDetailMock = vi.fn();

vi.mock("@/components/community/PostDetailModal", () => ({
  default: (props: { post: { id: string; title: string }; onClose: () => void }) => {
    postDetailMock(props);
    return (
      <div data-testid="post-detail-modal-mock">
        <span data-testid="mock-post-id">{props.post.id}</span>
        <span data-testid="mock-post-title">{props.post.title}</span>
      </div>
    );
  },
}));

const profilePayload: SharePayload = {
  kind: "profile",
  snapshot: { userId: "u-2", displayName: "Maria", avatarUrl: null, bio: "Mestra de D&D" },
};

const libraryPayload: SharePayload = {
  kind: "library_item",
  snapshot: {
    contentType: "spells",
    contentId: "s-1",
    name: "Bola de Fogo",
    description: "Uma esfera de fogo explode no alvo.",
    imageUrl: null,
  },
};

const postPayload: SharePayload = {
  kind: "post",
  snapshot: {
    postId: "p-1",
    title: "Post épico",
    description: "Descrição do post",
    contentType: "spell",
    tags: ["fogo"],
    authorId: "u-3",
    authorName: "João",
    payload: { name: "Bola de Fogo" },
  },
};

describe("ShareDetailModal", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renderiza 'Iniciar chat' em perfil de outro usuário e chama onStartDm com o userId", () => {
    const onStartDm = vi.fn();
    const onClose = vi.fn();
    render(
      <ShareDetailModal
        payload={profilePayload}
        currentUserId="u-1"
        onClose={onClose}
        onStartDm={onStartDm}
      />,
    );
    const button = screen.getByTestId("start-dm-from-card");
    expect(button).toHaveTextContent("Iniciar chat");
    fireEvent.click(button);
    expect(onStartDm).toHaveBeenCalledWith("u-2");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("não renderiza 'Iniciar chat' quando o perfil é do próprio usuário", () => {
    render(
      <ShareDetailModal
        payload={profilePayload}
        currentUserId="u-2"
        onClose={vi.fn()}
        onStartDm={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("start-dm-from-card")).not.toBeInTheDocument();
  });

  it("renderiza nome e label do tipo em library_item", () => {
    render(
      <ShareDetailModal payload={libraryPayload} currentUserId="u-1" onClose={vi.fn()} />,
    );
    expect(screen.getByText("Bola de Fogo")).toBeInTheDocument();
    expect(screen.getByText("magia")).toBeInTheDocument();
  });

  it("renderiza PostDetailModal com post montado a partir do snapshot", () => {
    render(
      <ShareDetailModal payload={postPayload} currentUserId="u-1" onClose={vi.fn()} />,
    );
    expect(screen.getByTestId("post-detail-modal-mock")).toBeInTheDocument();
    expect(screen.getByTestId("mock-post-id")).toHaveTextContent("p-1");
    expect(screen.getByTestId("mock-post-title")).toHaveTextContent("Post épico");
    expect(postDetailMock).toHaveBeenCalledTimes(1);
    const props = postDetailMock.mock.calls[0][0];
    expect(props.post.id).toBe("p-1");
    expect(props.post.title).toBe("Post épico");
  });
});
