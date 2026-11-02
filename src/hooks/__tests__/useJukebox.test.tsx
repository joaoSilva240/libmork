import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useJukebox } from "../useJukebox";
import type { AudioTrack } from "@/lib/audio/jukebox-protocol";

// Mock useSocket
const mockEmitAudioTrackAdd = vi.fn();
const mockEmitAudioTrackPlay = vi.fn();
const mockEmitAudioTrackPause = vi.fn();
const mockEmitAudioTrackLoop = vi.fn();
const mockEmitAudioTrackRemove = vi.fn();

let mockSubscribeAudioTrackAdd = vi.fn(() => vi.fn());
let mockSubscribeAudioTrackPlay = vi.fn(() => vi.fn());
let mockSubscribeAudioTrackPause = vi.fn(() => vi.fn());
let mockSubscribeAudioTrackLoop = vi.fn(() => vi.fn());
let mockSubscribeAudioTrackRemove = vi.fn(() => vi.fn());
let mockSubscribeAudioTrackState = vi.fn(() => vi.fn());

vi.mock("@/context/SocketContext", () => ({
  useSocket: () => ({
    emitAudioTrackAdd: mockEmitAudioTrackAdd,
    emitAudioTrackPlay: mockEmitAudioTrackPlay,
    emitAudioTrackPause: mockEmitAudioTrackPause,
    emitAudioTrackLoop: mockEmitAudioTrackLoop,
    emitAudioTrackRemove: mockEmitAudioTrackRemove,
    subscribeAudioTrackAdd: mockSubscribeAudioTrackAdd,
    subscribeAudioTrackPlay: mockSubscribeAudioTrackPlay,
    subscribeAudioTrackPause: mockSubscribeAudioTrackPause,
    subscribeAudioTrackLoop: mockSubscribeAudioTrackLoop,
    subscribeAudioTrackRemove: mockSubscribeAudioTrackRemove,
    subscribeAudioTrackState: mockSubscribeAudioTrackState,
  }),
}));

describe("useJukebox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscribeAudioTrackAdd = vi.fn(() => vi.fn());
    mockSubscribeAudioTrackPlay = vi.fn(() => vi.fn());
    mockSubscribeAudioTrackPause = vi.fn(() => vi.fn());
    mockSubscribeAudioTrackLoop = vi.fn(() => vi.fn());
    mockSubscribeAudioTrackRemove = vi.fn(() => vi.fn());
    mockSubscribeAudioTrackState = vi.fn(() => vi.fn());
  });

  describe("addTrack", () => {
    it("should reject invalid YouTube URL", () => {
      const { result } = renderHook(() => useJukebox("campaign-1", true));

      let response: { ok: boolean; error?: string };
      act(() => {
        response = result.current.addTrack("https://vimeo.com/123456", "user-1", "Master");
      });

      expect(response!).toEqual({ ok: false, error: "URL inválida do YouTube" });
      expect(mockEmitAudioTrackAdd).not.toHaveBeenCalled();
    });

    it("should add valid YouTube URL and emit event", () => {
      const { result } = renderHook(() => useJukebox("campaign-1", true));

      let response: { ok: boolean; error?: string };
      act(() => {
        response = result.current.addTrack("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "user-1", "Master");
      });

      expect(response!).toEqual({ ok: true });
      expect(result.current.tracks).toHaveLength(1);
      expect(result.current.tracks[0].id).toBe("dQw4w9WgXcQ");
      expect(mockEmitAudioTrackAdd).toHaveBeenCalledWith({
        campaignId: "campaign-1",
        actorName: "Master",
        track: expect.objectContaining({
          id: "dQw4w9WgXcQ",
          title: "dQw4w9WgXcQ",
          addedBy: "user-1",
        }),
      });
    });

    it("should deduplicate track with same id", () => {
      const { result } = renderHook(() => useJukebox("campaign-1", true));

      act(() => {
        result.current.addTrack("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "user-1", "Master");
        result.current.addTrack("https://youtu.be/dQw4w9WgXcQ", "user-1", "Master");
      });

      expect(result.current.tracks).toHaveLength(1);
      expect(mockEmitAudioTrackAdd).toHaveBeenCalledTimes(2);
    });

    it("should not emit when isMaster is false", () => {
      const { result } = renderHook(() => useJukebox("campaign-1", false));

      let response: { ok: boolean; error?: string };
      act(() => {
        response = result.current.addTrack("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "user-1", "Master");
      });

      expect(response!.ok).toBe(false);
      expect(mockEmitAudioTrackAdd).not.toHaveBeenCalled();
    });
  });

  describe("togglePlay", () => {
    it("should emit play event when no track is playing", () => {
      const { result } = renderHook(() => useJukebox("campaign-1", true));

      act(() => {
        result.current.addTrack("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "user-1", "Master");
      });

      act(() => {
        result.current.togglePlay("dQw4w9WgXcQ");
      });

      expect(result.current.playingTrackId).toBe("dQw4w9WgXcQ");
      expect(result.current.playingAt).toBeTypeOf("number");
      expect(mockEmitAudioTrackPlay).toHaveBeenCalledWith({
        campaignId: "campaign-1",
        trackId: "dQw4w9WgXcQ",
        playingAt: expect.any(Number),
      });
    });

    it("should emit pause event when track is already playing", () => {
      const { result } = renderHook(() => useJukebox("campaign-1", true));

      act(() => {
        result.current.addTrack("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "user-1", "Master");
        result.current.togglePlay("dQw4w9WgXcQ");
      });

      act(() => {
        result.current.togglePlay("dQw4w9WgXcQ");
      });

      expect(result.current.playingTrackId).toBeNull();
      expect(result.current.playingAt).toBeNull();
      expect(mockEmitAudioTrackPause).toHaveBeenCalledWith({
        campaignId: "campaign-1",
        trackId: "dQw4w9WgXcQ",
      });
    });

    it("should not emit when isMaster is false", () => {
      const { result } = renderHook(() => useJukebox("campaign-1", false));

      act(() => {
        result.current.togglePlay("dQw4w9WgXcQ");
      });

      expect(mockEmitAudioTrackPlay).not.toHaveBeenCalled();
      expect(mockEmitAudioTrackPause).not.toHaveBeenCalled();
    });
  });

  describe("toggleLoop", () => {
    it("should toggle loop state and emit event", () => {
      const { result } = renderHook(() => useJukebox("campaign-1", true));

      act(() => {
        result.current.addTrack("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "user-1", "Master");
      });

      act(() => {
        result.current.toggleLoop("dQw4w9WgXcQ");
      });

      expect(result.current.loopTrackIds.has("dQw4w9WgXcQ")).toBe(true);
      expect(mockEmitAudioTrackLoop).toHaveBeenCalledWith({
        campaignId: "campaign-1",
        trackId: "dQw4w9WgXcQ",
        loop: true,
      });

      act(() => {
        result.current.toggleLoop("dQw4w9WgXcQ");
      });

      expect(result.current.loopTrackIds.has("dQw4w9WgXcQ")).toBe(false);
      expect(mockEmitAudioTrackLoop).toHaveBeenCalledWith({
        campaignId: "campaign-1",
        trackId: "dQw4w9WgXcQ",
        loop: false,
      });
    });

    it("should not emit when isMaster is false", () => {
      const { result } = renderHook(() => useJukebox("campaign-1", false));

      act(() => {
        result.current.toggleLoop("dQw4w9WgXcQ");
      });

      expect(mockEmitAudioTrackLoop).not.toHaveBeenCalled();
    });
  });

  describe("removeTrack", () => {
    it("should remove track locally and emit event", () => {
      const { result } = renderHook(() => useJukebox("campaign-1", true));

      act(() => {
        result.current.addTrack("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "user-1", "Master");
        result.current.toggleLoop("dQw4w9WgXcQ");
        result.current.togglePlay("dQw4w9WgXcQ");
      });

      act(() => {
        result.current.removeTrack("dQw4w9WgXcQ");
      });

      expect(result.current.tracks).toHaveLength(0);
      expect(result.current.loopTrackIds.has("dQw4w9WgXcQ")).toBe(false);
      expect(result.current.playingTrackId).toBeNull();
      expect(result.current.playingAt).toBeNull();
      expect(mockEmitAudioTrackRemove).toHaveBeenCalledWith({
        campaignId: "campaign-1",
        trackId: "dQw4w9WgXcQ",
      });
    });

    it("should not emit when isMaster is false", () => {
      const { result } = renderHook(() => useJukebox("campaign-1", false));

      act(() => {
        result.current.removeTrack("dQw4w9WgXcQ");
      });

      expect(mockEmitAudioTrackRemove).not.toHaveBeenCalled();
    });
  });

  describe("remote events (subscribers)", () => {
    it("should append track on remote audio:track-add event", () => {
      let addHandler: ((payload: any) => void) | null = null;
      mockSubscribeAudioTrackAdd = vi.fn((handler: (payload: any) => void) => {
        addHandler = handler;
        return vi.fn();
      });

      const { result } = renderHook(() => useJukebox("campaign-1", false));

      expect(addHandler).toBeTruthy();

      const track: AudioTrack = {
        id: "remoteTrack1",
        title: "Remote Track",
        addedBy: "master-1",
        addedAt: new Date().toISOString(),
      };

      act(() => {
        addHandler!({ campaignId: "campaign-1", actorName: "Master", track });
      });

      expect(result.current.tracks).toHaveLength(1);
      expect(result.current.tracks[0].id).toBe("remoteTrack1");
    });

    it("should update playingTrackId on remote audio:track-play event", () => {
      let playHandler: ((payload: any) => void) | null = null;
      mockSubscribeAudioTrackPlay = vi.fn((handler: (payload: any) => void) => {
        playHandler = handler;
        return vi.fn();
      });

      const { result } = renderHook(() => useJukebox("campaign-1", false));

      act(() => {
        playHandler!({ campaignId: "campaign-1", trackId: "track-1", playingAt: 1234567890 });
      });

      expect(result.current.playingTrackId).toBe("track-1");
      expect(result.current.playingAt).toBe(1234567890);
    });

    it("should replace full state on remote audio:track-state event", () => {
      let stateHandler: ((payload: any) => void) | null = null;
      mockSubscribeAudioTrackState = vi.fn((handler: (payload: any) => void) => {
        stateHandler = handler;
        return vi.fn();
      });

      const { result } = renderHook(() => useJukebox("campaign-1", false));

      const tracks: AudioTrack[] = [
        { id: "track-1", title: "Track 1", addedBy: "user-1", addedAt: new Date().toISOString() },
        { id: "track-2", title: "Track 2", addedBy: "user-1", addedAt: new Date().toISOString() },
      ];

      act(() => {
        stateHandler!({
          campaignId: "campaign-1",
          tracks,
          playingTrackId: "track-1",
          playingAt: 9876543210,
          loopTrackIds: ["track-2"],
        });
      });

      expect(result.current.tracks).toHaveLength(2);
      expect(result.current.playingTrackId).toBe("track-1");
      expect(result.current.playingAt).toBe(9876543210);
      expect(result.current.loopTrackIds.has("track-2")).toBe(true);
    });

    it("should ignore events from different campaignId", () => {
      let addHandler: ((payload: any) => void) | null = null;
      mockSubscribeAudioTrackAdd = vi.fn((handler: (payload: any) => void) => {
        addHandler = handler;
        return vi.fn();
      });

      const { result } = renderHook(() => useJukebox("campaign-1", false));

      const track: AudioTrack = {
        id: "track-x",
        title: "Track X",
        addedBy: "user-1",
        addedAt: new Date().toISOString(),
      };

      act(() => {
        addHandler!({ campaignId: "campaign-999", actorName: "Master", track });
      });

      expect(result.current.tracks).toHaveLength(0);
    });
  });

  describe("player mode (isMaster: false)", () => {
    it("should not allow addTrack", () => {
      const { result } = renderHook(() => useJukebox("campaign-1", false));

      let response: { ok: boolean; error?: string };
      act(() => {
        response = result.current.addTrack("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "user-1", "Player");
      });

      expect(response!.ok).toBe(false);
      expect(mockEmitAudioTrackAdd).not.toHaveBeenCalled();
    });

    it("should not allow removeTrack", () => {
      const { result } = renderHook(() => useJukebox("campaign-1", false));

      act(() => {
        result.current.removeTrack("track-1");
      });

      expect(mockEmitAudioTrackRemove).not.toHaveBeenCalled();
    });

    it("should not allow togglePlay", () => {
      const { result } = renderHook(() => useJukebox("campaign-1", false));

      act(() => {
        result.current.togglePlay("track-1");
      });

      expect(mockEmitAudioTrackPlay).not.toHaveBeenCalled();
      expect(mockEmitAudioTrackPause).not.toHaveBeenCalled();
    });

    it("should not allow toggleLoop", () => {
      const { result } = renderHook(() => useJukebox("campaign-1", false));

      act(() => {
        result.current.toggleLoop("track-1");
      });

      expect(mockEmitAudioTrackLoop).not.toHaveBeenCalled();
    });
  });

  describe("campaign filtering", () => {
    it("should ignore add event with different campaignId", () => {
      let addHandler: ((payload: any) => void) | null = null;
      mockSubscribeAudioTrackAdd = vi.fn((handler: (payload: any) => void) => {
        addHandler = handler;
        return vi.fn();
      });

      const { result } = renderHook(() => useJukebox("campaign-1", false));

      const track: AudioTrack = {
        id: "track-other",
        title: "Other Campaign Track",
        addedBy: "user-1",
        addedAt: new Date().toISOString(),
      };

      act(() => {
        addHandler!({ campaignId: "campaign-other", actorName: "Master", track });
      });

      expect(result.current.tracks).toHaveLength(0);
    });

    it("should ignore play event with different campaignId", () => {
      let playHandler: ((payload: any) => void) | null = null;
      mockSubscribeAudioTrackPlay = vi.fn((handler: (payload: any) => void) => {
        playHandler = handler;
        return vi.fn();
      });

      const { result } = renderHook(() => useJukebox("campaign-1", false));

      act(() => {
        playHandler!({ campaignId: "campaign-other", trackId: "track-1", playingAt: 123456 });
      });

      expect(result.current.playingTrackId).toBeNull();
    });
  });
});
