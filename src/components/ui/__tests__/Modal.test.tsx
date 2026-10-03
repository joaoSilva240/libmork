import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Modal } from "../Modal";

describe("Modal", () => {
  afterEach(() => {
    document.body.style.overflow = "";
  });

  it("renders conditionally with dialog accessibility attributes", () => {
    const { rerender } = render(
      <Modal open={false} onClose={() => undefined} labelledBy="modal-title">
        <Modal.Header>
          <h2 id="modal-title">Título</h2>
        </Modal.Header>
        <Modal.Body>Conteúdo</Modal.Body>
      </Modal>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    rerender(
      <Modal open onClose={() => undefined} labelledBy="modal-title">
        <Modal.Header>
          <h2 id="modal-title">Título</h2>
        </Modal.Header>
        <Modal.Body>Conteúdo</Modal.Body>
      </Modal>,
    );
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-labelledby", "modal-title");
    expect(screen.getByText("Conteúdo")).toBeInTheDocument();
  });

  it("closes from Escape and backdrop, but not content", () => {
    let closeCount = 0;
    render(
      <Modal
        open
        onClose={() => {
          closeCount += 1;
        }}
      >
        <Modal.Body>Conteúdo</Modal.Body>
      </Modal>,
    );
    fireEvent.click(screen.getByText("Conteúdo"));
    expect(closeCount).toBe(0);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(closeCount).toBe(1);
    fireEvent.click(screen.getByRole("dialog").parentElement?.parentElement as HTMLElement);
    expect(closeCount).toBe(2);
  });

  it("locks and restores body scroll and returns focus to the opener", () => {
    document.body.style.overflow = "scroll";
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const { rerender } = render(
      <Modal open onClose={() => undefined}>
        <Modal.Body>Conteúdo</Modal.Body>
      </Modal>,
    );
    expect(document.body.style.overflow).toBe("hidden");
    rerender(
      <Modal open={false} onClose={() => undefined}>
        <Modal.Body>Conteúdo</Modal.Body>
      </Modal>,
    );
    expect(document.body.style.overflow).toBe("scroll");
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});
