import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MasterCommunityView } from "../MasterCommunityView";

const { searchParamsState, campaignChatProps } = vi.hoisted(() => ({
  searchParamsState: { value: "" },
  campaignChatProps: [] as Record<string, unknown>[],
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(searchParamsState.value),
}));

vi.mock("../CommunityFeed", () => ({
  default: () => <div data-testid="mock-community-feed">Mural de Conteúdo Mock</div>,
}));

vi.mock("@/components/chat/CampaignChat", () => ({
  CampaignChat: (props: Record<string, unknown>) => {
    campaignChatProps.push(props);
    return <div data-testid="mock-campaign-chat">Chat de Campanha Mock</div>;
  },
}));

vi.mock("@/components/sessions/MasterSessionCalendar", () => ({
  MasterSessionCalendar: () => <div data-testid="mock-master-calendar">Calendário Mock</div>,
}));

describe("MasterCommunityView (Issue #62)", () => {
  const currentUser = {
    id: "user-1",
    masterName: "Mestre",
    masterAvatar: null,
    displayName: "João Mestre",
  };

  beforeEach(() => {
    searchParamsState.value = "";
    campaignChatProps.length = 0;
  });

  it("renderiza as abas de Mural de Conteúdo e Grupos de Campanha", () => {
    render(<MasterCommunityView currentUser={currentUser} />);

    expect(screen.getByTestId("tab-community-feed")).toBeInTheDocument();
    expect(screen.getByTestId("tab-campaign-chat")).toBeInTheDocument();
    expect(screen.getByTestId("mock-community-feed")).toBeInTheDocument();
  });

  it("alterna entre o Mural e os Grupos de Campanha ao clicar nas abas", () => {
    render(<MasterCommunityView currentUser={currentUser} />);

    const chatTab = screen.getByTestId("tab-campaign-chat");
    fireEvent.click(chatTab);

    expect(screen.getByTestId("mock-campaign-chat")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-community-feed")).not.toBeInTheDocument();

    const feedTab = screen.getByTestId("tab-community-feed");
    fireEvent.click(feedTab);

    expect(screen.getByTestId("mock-community-feed")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-campaign-chat")).not.toBeInTheDocument();
  });

  it("abre a aba de chat com initialGroupId quando há tab=chat&dm na URL (Task 11)", () => {
    searchParamsState.value = "tab=chat&dm=g-9";
    render(<MasterCommunityView currentUser={currentUser} />);

    expect(screen.getByTestId("mock-campaign-chat")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-community-feed")).not.toBeInTheDocument();
    expect(screen.getByTestId("tab-campaign-chat").className).toContain("bg-accent");

    const lastProps = campaignChatProps[campaignChatProps.length - 1];
    expect(lastProps.initialGroupId).toBe("g-9");
  });

  it("não passa initialGroupId quando a URL não tem parâmetro dm", () => {
    render(<MasterCommunityView currentUser={currentUser} />);
    fireEvent.click(screen.getByTestId("tab-campaign-chat"));

    const lastProps = campaignChatProps[campaignChatProps.length - 1];
    expect(lastProps.initialGroupId).toBeUndefined();
  });

  it("renderiza a aba Calendário e mostra MasterSessionCalendar ao clicá-la (Task 11)", () => {
    render(<MasterCommunityView currentUser={currentUser} />);

    expect(screen.getByTestId("tab-master-calendar")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("tab-master-calendar"));

    expect(screen.getByTestId("mock-master-calendar")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-community-feed")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mock-campaign-chat")).not.toBeInTheDocument();
  });
});
