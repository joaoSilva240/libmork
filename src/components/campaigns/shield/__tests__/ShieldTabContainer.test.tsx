import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { Music, MapPin, Image } from "lucide-react";
import { ShieldTabContainer, type ShieldTabDef } from "../ShieldTabContainer";

const PERSIST_KEY = "libmork:shield-tab:test";

const tabs = (extra: Partial<Record<string, Partial<ShieldTabDef>>> = {}): ShieldTabDef[] =>
  [
    {
      id: "worlds",
      label: "Mundos",
      icon: MapPin,
      visible: true,
      content: <div data-testid="tab-worlds">Mundos</div>,
    },
    {
      id: "assets",
      label: "Assets",
      icon: Image,
      visible: true,
      content: <div data-testid="tab-assets">Assets</div>,
    },
    {
      id: "jukebox",
      label: "Jukebox",
      icon: Music,
      visible: true,
      content: <div data-testid="tab-jukebox">Jukebox</div>,
    },
  ].map((tab) => ({ ...tab, ...extra[tab.id] }));

describe("ShieldTabContainer (issue #89)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders tabs with icon buttons, role tablist and aria-selected", () => {
    render(<ShieldTabContainer persistKey={PERSIST_KEY} tabs={tabs()} />);

    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getByTestId("shield-tab-worlds")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("shield-tab-assets")).toHaveAttribute("aria-selected", "false");
  });

  it("switches active tab on click and keeps other panels mounted (hidden)", () => {
    render(<ShieldTabContainer persistKey={PERSIST_KEY} tabs={tabs()} />);

    fireEvent.click(screen.getByTestId("shield-tab-assets"));

    expect(screen.getByTestId("shield-tab-assets")).toHaveAttribute("aria-selected", "true");
    // Todas as abas continuam montadas para preservar estado/áudio.
    expect(screen.getByTestId("tab-worlds")).toBeInTheDocument();
    expect(screen.getByTestId("tab-jukebox")).toBeInTheDocument();
    // Painel inativo fica oculto via atributo hidden.
    expect(screen.getByTestId("shield-tabpanel-worlds")).toHaveAttribute("hidden", "");
    expect(screen.getByTestId("shield-tabpanel-assets")).not.toHaveAttribute("hidden");
  });

  it("persists the last selected tab and restores it after remount", async () => {
    const { unmount } = render(<ShieldTabContainer persistKey={PERSIST_KEY} tabs={tabs()} />);

    fireEvent.click(screen.getByTestId("shield-tab-jukebox"));
    expect(localStorage.getItem(PERSIST_KEY)).toBe("jukebox");

    unmount();
    render(<ShieldTabContainer persistKey={PERSIST_KEY} tabs={tabs()} />);

    await waitFor(() => {
      expect(screen.getByTestId("shield-tab-jukebox")).toHaveAttribute("aria-selected", "true");
    });
  });

  it("hides disabled tabs from the header and falls back to the first visible tab", () => {
    render(
      <ShieldTabContainer
        persistKey={PERSIST_KEY}
        tabs={tabs({
          worlds: { visible: false },
          assets: { visible: false },
          jukebox: { visible: false },
        })}
      />
    );

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByTestId("tab-worlds")).not.toBeInTheDocument();
  });

  it("falls back to the first visible tab when the stored tab becomes invisible", async () => {
    localStorage.setItem(PERSIST_KEY, "worlds");

    render(
      <ShieldTabContainer
        persistKey={PERSIST_KEY}
        tabs={tabs({ worlds: { visible: false } })}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("shield-tab-assets")).toHaveAttribute("aria-selected", "true");
    });
  });

  it("supports keyboard navigation with arrow keys", () => {
    render(<ShieldTabContainer persistKey={PERSIST_KEY} tabs={tabs()} />);

    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowRight" });
    expect(screen.getByTestId("shield-tab-assets")).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowLeft" });
    expect(screen.getByTestId("shield-tab-worlds")).toHaveAttribute("aria-selected", "true");
  });

  it("renders content directly without header when only one tab is visible", () => {
    render(
      <ShieldTabContainer persistKey={PERSIST_KEY} tabs={tabs({ assets: { visible: false }, jukebox: { visible: false } })} />
    );

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.getByTestId("tab-worlds")).toBeInTheDocument();
  });
});
