import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SharePickerModal } from "../SharePickerModal";

const catalog = {
  success: true,
  data: {
    posts: [{ id: "p-1", title: "Post épico", contentType: "spell", authorName: "Maria" }],
    campaigns: [{ id: "c-1", name: "Strahd", coverImageUrl: null }],
  },
};

const searchResults = {
  success: true,
  data: {
    users: [],
    libraryItems: [
      {
        id: "s-1",
        name: "Bola de Fogo",
        contentType: "spells",
        description: "Explode em chamas.",
        imageUrl: null,
      },
    ],
  },
};

function stubFetch() {
  return vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/chat/search")) {
        return Promise.resolve({ ok: true, json: async () => searchResults });
      }
      return Promise.resolve({ ok: true, json: async () => catalog });
    }),
  );
}

describe("SharePickerModal", () => {
  beforeEach(() => stubFetch());

  afterEach(() => vi.unstubAllGlobals());

  it("mostra dica e não busca biblioteca antes de 3 caracteres", async () => {
    const onPick = vi.fn();
    render(<SharePickerModal isOpen onClose={vi.fn()} onPick={onPick} />);

    expect(
      await screen.findByText(/Digite ao menos 3 caracteres/i),
    ).toBeInTheDocument();
    expect(screen.queryByText("Bola de Fogo")).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId("share-search-input"), { target: { value: "bo" } });
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(screen.queryByText("Bola de Fogo")).not.toBeInTheDocument();
  });

  it("busca e lista itens da biblioteca a partir de 3 caracteres e emite pick", async () => {
    const onPick = vi.fn();
    render(<SharePickerModal isOpen onClose={vi.fn()} onPick={onPick} />);

    fireEvent.change(screen.getByTestId("share-search-input"), { target: { value: "bola" } });

    const item = await screen.findByText("Bola de Fogo");
    expect(item).toBeInTheDocument();
    fireEvent.click(item);
    expect(onPick).toHaveBeenCalledWith(
      { kind: "library_item", id: "s-1", contentType: "spells" },
      "Bola de Fogo",
    );
  });

  it("troca para a aba de campanhas", async () => {
    render(<SharePickerModal isOpen onClose={vi.fn()} onPick={vi.fn()} />);

    fireEvent.click(await screen.findByTestId("share-tab-campaigns"));
    expect(await screen.findByText("Strahd")).toBeInTheDocument();
  });
});
