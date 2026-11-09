import React from "react";
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SocketProvider, useSocket } from "../SocketContext";
import * as dice3dModule from "@/lib/dice3d";
import { io } from "socket.io-client";

vi.mock("socket.io-client", () => ({
  io: vi.fn(),
}));

vi.mock("@/lib/dice3d", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/dice3d")>();
  return {
    ...actual,
    showDice3D: vi.fn(),
  };
});

describe("SocketContext 3D Dice Remote Filtering (Issue #74)", () => {
  let mockSocket: any;
  const handlers: Record<string, Function> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    handlers["dice-rolled"] = undefined as any;
    handlers["campaign:dice3d-settings-updated"] = undefined as any;

    mockSocket = {
      id: "socket-client-1",
      on: vi.fn((event, cb) => {
        handlers[event] = cb;
      }),
      off: vi.fn(),
      emit: vi.fn(),
      connected: true,
      disconnect: vi.fn(),
    };

    vi.mocked(io).mockReturnValue(mockSocket);
  });

  it("triggers showDice3D for master when player rolls and dice3dPlayersEnabled is true", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SocketProvider>{children}</SocketProvider>
    );

    const { result } = renderHook(() => useSocket(), { wrapper });

    act(() => {
      result.current.joinCampaign({
        campaignId: "camp-1",
        role: "master",
        user: { id: "master-1", name: "Mestre" },
      });
      result.current.setCampaignDice3DSettings("camp-1", {
        dice3dPlayersEnabled: true,
        dice3dMasterEnabled: true,
      });
    });

    // Simulate dice-rolled received from player
    act(() => {
      handlers["dice-rolled"]?.({
        campaignId: "camp-1",
        actorId: "char-player-1",
        actorName: "Guerreiro",
        rollType: "ataque",
        formula: "1d20+3",
        result: 18,
        senderRole: "player",
        senderSocketId: "socket-player-99",
        rolledDice: [{ sides: 20, value: 15 }],
      });
    });

    expect(dice3dModule.showDice3D).toHaveBeenCalledWith([{ sides: 20, value: 15 }]);
  });

  it("does NOT trigger showDice3D for master when dice3dPlayersEnabled is false", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SocketProvider>{children}</SocketProvider>
    );

    const { result } = renderHook(() => useSocket(), { wrapper });

    act(() => {
      result.current.joinCampaign({
        campaignId: "camp-1",
        role: "master",
      });
      result.current.setCampaignDice3DSettings("camp-1", {
        dice3dPlayersEnabled: false,
        dice3dMasterEnabled: true,
      });
    });

    act(() => {
      handlers["dice-rolled"]?.({
        campaignId: "camp-1",
        actorId: "char-player-1",
        actorName: "Guerreiro",
        rollType: "ataque",
        formula: "1d20+3",
        result: 18,
        senderRole: "player",
        senderSocketId: "socket-player-99",
        rolledDice: [{ sides: 20, value: 15 }],
      });
    });

    expect(dice3dModule.showDice3D).not.toHaveBeenCalled();
  });

  it("triggers showDice3D for player when master rolls and dice3dMasterEnabled is true", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SocketProvider>{children}</SocketProvider>
    );

    const { result } = renderHook(() => useSocket(), { wrapper });

    act(() => {
      result.current.joinCampaign({
        campaignId: "camp-1",
        role: "player",
      });
      result.current.setCampaignDice3DSettings("camp-1", {
        dice3dPlayersEnabled: true,
        dice3dMasterEnabled: true,
      });
    });

    act(() => {
      handlers["dice-rolled"]?.({
        campaignId: "camp-1",
        actorId: "npc-boss",
        actorName: "Dragão",
        rollType: "ataque",
        formula: "1d20+8",
        result: 22,
        senderRole: "master",
        senderSocketId: "socket-master-99",
        rolledDice: [{ sides: 20, value: 14 }],
      });
    });

    expect(dice3dModule.showDice3D).toHaveBeenCalledWith([{ sides: 20, value: 14 }]);
  });

  it("does NOT trigger showDice3D for player when master rolls and dice3dMasterEnabled is false", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SocketProvider>{children}</SocketProvider>
    );

    const { result } = renderHook(() => useSocket(), { wrapper });

    act(() => {
      result.current.joinCampaign({
        campaignId: "camp-1",
        role: "player",
      });
      result.current.setCampaignDice3DSettings("camp-1", {
        dice3dPlayersEnabled: true,
        dice3dMasterEnabled: false,
      });
    });

    act(() => {
      handlers["dice-rolled"]?.({
        campaignId: "camp-1",
        actorId: "npc-boss",
        actorName: "Dragão",
        rollType: "ataque",
        formula: "1d20+8",
        result: 22,
        senderRole: "master",
        senderSocketId: "socket-master-99",
        rolledDice: [{ sides: 20, value: 14 }],
      });
    });

    expect(dice3dModule.showDice3D).not.toHaveBeenCalled();
  });

  it("ignores rolls originating from the same socket to prevent double animation", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SocketProvider>{children}</SocketProvider>
    );

    const { result } = renderHook(() => useSocket(), { wrapper });

    act(() => {
      result.current.joinCampaign({
        campaignId: "camp-1",
        role: "master",
      });
    });

    act(() => {
      handlers["dice-rolled"]?.({
        campaignId: "camp-1",
        actorId: "actor-self",
        actorName: "Self",
        formula: "1d20",
        result: 10,
        senderSocketId: "socket-client-1", // same as mockSocket.id
        rolledDice: [{ sides: 20, value: 10 }],
      });
    });

    expect(dice3dModule.showDice3D).not.toHaveBeenCalled();
  });

  it("updates settings dynamically via campaign:dice3d-settings-updated socket event", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SocketProvider>{children}</SocketProvider>
    );

    const { result } = renderHook(() => useSocket(), { wrapper });

    act(() => {
      result.current.joinCampaign({
        campaignId: "camp-1",
        role: "player",
      });
    });

    // Receive broadcast from master turning master 3D dice off
    act(() => {
      handlers["campaign:dice3d-settings-updated"]?.({
        campaignId: "camp-1",
        dice3dPlayersEnabled: true,
        dice3dMasterEnabled: false,
      });
    });

    act(() => {
      handlers["dice-rolled"]?.({
        campaignId: "camp-1",
        actorId: "npc-boss",
        actorName: "Dragão",
        rollType: "ataque",
        formula: "1d20+8",
        result: 22,
        senderRole: "master",
        senderSocketId: "socket-master-99",
        rolledDice: [{ sides: 20, value: 14 }],
      });
    });

    expect(dice3dModule.showDice3D).not.toHaveBeenCalled();
  });

  it("broadcastCampaignDice3DSettings emits campaign:dice3d-settings-update event", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SocketProvider>{children}</SocketProvider>
    );

    const { result } = renderHook(() => useSocket(), { wrapper });

    act(() => {
      result.current.broadcastCampaignDice3DSettings({
        campaignId: "camp-1",
        dice3dPlayersEnabled: false,
        dice3dMasterEnabled: true,
      });
    });

    expect(mockSocket.emit).toHaveBeenCalledWith("campaign:dice3d-settings-update", {
      campaignId: "camp-1",
      dice3dPlayersEnabled: false,
      dice3dMasterEnabled: true,
    });
  });
});
