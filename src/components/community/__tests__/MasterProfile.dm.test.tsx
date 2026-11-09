import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MasterProfile, { MasterProfileData } from "../MasterProfile";

const { routerMock } = vi.hoisted(() => ({
  routerMock: { push: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

const mockProfile: MasterProfileData = {
  id: "u-2",
  displayName: "maria_mestra",
  masterName: "Maria, a Mestra",
  masterAvatar: null,
  masterBio: "Mestra de D&D há 10 anos.",
  masterBannerUrl: null,
  statistics: {
    campaigns: 2,
    sessions: 10,
    spells: 3,
    items: 1,
    classes: 0,
    npcs: 4,
    worlds: 1,
  },
};

describe("MasterProfile — iniciar DM pelo @handle (Task 11)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes("/api/chat/dm")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, data: { id: "dm-1" } }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [] }),
        });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("clicar no @handle de terceiro cria a DM e navega para o chat", async () => {
    render(<MasterProfile userId="u-2" profileData={mockProfile} currentUserId="u-1" />);

    const dmButton = screen.getByTestId("start-dm-button");
    expect(dmButton).toHaveTextContent("@maria_mestra");
    fireEvent.click(dmButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/chat/dm",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ userId: "u-2" }),
        }),
      );
      expect(routerMock.push).toHaveBeenCalledWith("/master/community?tab=chat&dm=dm-1");
    });
  });

  it("perfil próprio não exibe o botão de DM", () => {
    render(<MasterProfile userId="u-2" profileData={mockProfile} currentUserId="u-2" />);

    expect(screen.queryByTestId("start-dm-button")).not.toBeInTheDocument();
    expect(screen.getByText("@maria_mestra")).toBeInTheDocument();
  });
});
