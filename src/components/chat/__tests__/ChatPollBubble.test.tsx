import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ChatPollBubble } from "../ChatPollBubble";
import type { PollDetail } from "@/lib/server/chat-service";

describe("ChatPollBubble (Issue #62)", () => {
  const mockPoll: PollDetail = {
    id: "poll-1",
    title: "Qual dia da sessão?",
    isMultipleChoice: false,
    status: "open",
    closedAt: null,
    createdAt: new Date().toISOString(),
    createdById: "master-1",
    createdByName: "Mestre Arcano",
    totalVotes: 3,
    options: [
      {
        id: "opt-1",
        text: "Sexta 20h",
        position: 0,
        votesCount: 2,
        percentage: 67,
        hasVoted: false,
      },
      {
        id: "opt-2",
        text: "Sábado 18h",
        position: 1,
        votesCount: 1,
        percentage: 33,
        hasVoted: true,
      },
    ],
    userVotedOptionIds: ["opt-2"],
  };

  it("renderiza o título da enquete e as opções com contagens e porcentagens", () => {
    const onVote = vi.fn();
    const onClosePoll = vi.fn();

    render(
      <ChatPollBubble
        poll={mockPoll}
        isMaster={false}
        currentUserId="user-1"
        onVote={onVote}
        onClosePoll={onClosePoll}
      />,
    );

    expect(screen.getByText("Qual dia da sessão?")).toBeInTheDocument();
    expect(screen.getByText("Sexta 20h")).toBeInTheDocument();
    expect(screen.getByText("67%")).toBeInTheDocument();
    expect(screen.getByText("Sábado 18h")).toBeInTheDocument();
    expect(screen.getByText("33%")).toBeInTheDocument();
    expect(screen.getByText(/Total: 3 votos/i)).toBeInTheDocument();
  });

  it("chama onVote ao clicar em uma opção de voto", () => {
    const onVote = vi.fn().mockResolvedValue(undefined);
    const onClosePoll = vi.fn();

    render(
      <ChatPollBubble
        poll={mockPoll}
        isMaster={false}
        currentUserId="user-1"
        onVote={onVote}
        onClosePoll={onClosePoll}
      />,
    );

    const optButton = screen.getByTestId("poll-option-opt-1");
    fireEvent.click(optButton);

    expect(onVote).toHaveBeenCalledWith("poll-1", ["opt-1"]);
  });

  it("exibe botão de encerrar enquete apenas para o mestre/criador quando aberta", () => {
    const onVote = vi.fn();
    const onClosePoll = vi.fn().mockResolvedValue(undefined);

    const { rerender } = render(
      <ChatPollBubble
        poll={mockPoll}
        isMaster={false}
        currentUserId="player-2"
        onVote={onVote}
        onClosePoll={onClosePoll}
      />,
    );

    expect(screen.queryByTestId("close-poll-button")).not.toBeInTheDocument();

    rerender(
      <ChatPollBubble
        poll={mockPoll}
        isMaster={true}
        currentUserId="master-1"
        onVote={onVote}
        onClosePoll={onClosePoll}
      />,
    );

    const closeBtn = screen.getByTestId("close-poll-button");
    expect(closeBtn).toBeInTheDocument();
    fireEvent.click(closeBtn);
    expect(onClosePoll).toHaveBeenCalledWith("poll-1");
  });

  it("mostra badge de encerrada e desabilita votos quando status for closed", () => {
    const closedPoll: PollDetail = {
      ...mockPoll,
      status: "closed",
    };

    render(
      <ChatPollBubble
        poll={closedPoll}
        isMaster={true}
        currentUserId="master-1"
        onVote={vi.fn()}
        onClosePoll={vi.fn()}
      />,
    );

    expect(screen.getByTestId("poll-closed-badge")).toBeInTheDocument();
    const optButton = screen.getByTestId("poll-option-opt-1");
    expect(optButton).toBeDisabled();
    expect(screen.queryByTestId("close-poll-button")).not.toBeInTheDocument();
  });
});
