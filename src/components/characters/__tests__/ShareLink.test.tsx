import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ShareLink } from "../ShareLink";

let postSpy = vi.fn();

function stubFetch() {
  postSpy = vi.fn();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        postSpy(url, init);
        const kind = JSON.parse(init.body as string).kind;
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              id: `link-${kind}`,
              characterId: "char-1",
              token: `tok-${kind}`,
              kind,
              revoked: false,
              createdAt: new Date().toISOString(),
              url:
                kind === "acquire"
                  ? "http://localhost/characters/import/tok-acquire"
                  : "http://localhost/public-sheet/tok-view",
            },
          }),
        });
      }
      if (init?.method === "DELETE") {
        return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true, data: null }) });
    }),
  );
}

describe("ShareLink — dois tipos (Issue #79)", () => {
  beforeEach(() => stubFetch());
  afterEach(() => vi.unstubAllGlobals());

  it("renderiza seções de visualização e aquisição", async () => {
    render(<ShareLink characterId="char-1" />);
    expect(await screen.findByTestId("share-view-generate")).toBeInTheDocument();
    expect(screen.getByTestId("share-acquire-generate")).toBeInTheDocument();
  });

  it("gera link de visualização com kind view", async () => {
    render(<ShareLink characterId="char-1" />);
    fireEvent.click(await screen.findByTestId("share-view-generate"));

    await waitFor(() => expect(postSpy).toHaveBeenCalled());
    const [url, init] = postSpy.mock.calls[0];
    expect(url).toBe("/api/characters/char-1/share");
    expect(JSON.parse(init.body as string)).toEqual({ kind: "view" });
    expect(await screen.findByTestId("share-view-input")).toHaveValue(
      "http://localhost/public-sheet/tok-view",
    );
  });

  it("gera link de aquisição com kind acquire", async () => {
    render(<ShareLink characterId="char-1" />);
    fireEvent.click(await screen.findByTestId("share-acquire-generate"));

    await waitFor(() => expect(postSpy).toHaveBeenCalled());
    const [, init] = postSpy.mock.calls[0];
    expect(JSON.parse(init.body as string)).toEqual({ kind: "acquire" });
    expect(await screen.findByTestId("share-acquire-input")).toHaveValue(
      "http://localhost/characters/import/tok-acquire",
    );
  });

  it("carrega links ativos existentes por tipo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("kind=acquire")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              data: {
                id: "l-2",
                token: "tok-existente",
                kind: "acquire",
                revoked: false,
                url: "http://localhost/characters/import/tok-existente",
              },
            }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({ success: true, data: null }) });
      }),
    );
    render(<ShareLink characterId="char-1" />);
    expect(await screen.findByTestId("share-acquire-input")).toHaveValue(
      "http://localhost/characters/import/tok-existente",
    );
    expect(screen.queryByTestId("share-view-input")).not.toBeInTheDocument();
  });
});
