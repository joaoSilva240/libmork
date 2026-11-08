import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SharedContentCard } from "../SharedContentCard";
import type { SharePayload } from "@/lib/server/chat-service";

const profilePayload: SharePayload = {
  kind: "profile",
  snapshot: { userId: "u-2", displayName: "Maria", avatarUrl: null, bio: "Mestra de D&D" },
};

const campaignPayload: SharePayload = {
  kind: "campaign",
  snapshot: {
    campaignId: "c-1",
    name: "Maldição de Strahd",
    coverImageUrl: null,
    inviteToken: "tok",
    masterName: "João",
  },
};

describe("SharedContentCard", () => {
  it("renderiza card de perfil com nome e chama onClick", () => {
    const onClick = vi.fn();
    render(<SharedContentCard payload={profilePayload} onClick={onClick} />);
    const card = screen.getByTestId("shared-card-profile");
    expect(card).toHaveTextContent("Maria");
    fireEvent.click(card);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renderiza card de campanha com nome e mestre", () => {
    render(<SharedContentCard payload={campaignPayload} onClick={vi.fn()} />);
    const card = screen.getByTestId("shared-card-campaign");
    expect(card).toHaveTextContent("Maldição de Strahd");
    expect(card).toHaveTextContent("João");
  });
});
