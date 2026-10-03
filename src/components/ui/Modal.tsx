"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type HTMLAttributes,
  type ButtonHTMLAttributes,
  type ReactNode,
  type RefObject,
} from "react";

type ModalProps = {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  labelledBy?: string;
  titleId?: string;
  ariaLabel?: string;
  "aria-label"?: string;
  children: ReactNode;
  className?: string;
};

type ModalPartProps = HTMLAttributes<HTMLElement> & { children: ReactNode };

let lockCount = 0;
let originalBodyOverflow: string | null = null;
const modalStack: ModalEntry[] = [];

type ModalEntry = {
  dialog: HTMLDivElement | null;
  opener: HTMLElement | null;
};

function lockBodyScroll() {
  if (typeof document === "undefined") return;
  if (lockCount === 0) originalBodyOverflow = document.body.style.overflow;
  lockCount += 1;
  document.body.style.overflow = "hidden";
}

function unlockBodyScroll() {
  if (typeof document === "undefined" || lockCount === 0) return;
  lockCount -= 1;
  if (lockCount === 0) {
    document.body.style.overflow = originalBodyOverflow ?? "";
    originalBodyOverflow = null;
  }
}

const ModalContext = createContext<{ onClose: () => void } | null>(null);

function ModalHeader({ children, className = "", ...props }: ModalPartProps) {
  return (
    <header className={`shrink-0 ${className}`} {...props}>
      {children}
    </header>
  );
}

function ModalBody({ children, className = "", ...props }: ModalPartProps) {
  return (
    <section className={`min-h-0 flex-1 overflow-y-auto ${className}`} {...props}>
      {children}
    </section>
  );
}

function ModalFooter({ children, className = "", ...props }: ModalPartProps) {
  return (
    <footer className={`shrink-0 ${className}`} {...props}>
      {children}
    </footer>
  );
}

function ModalCloseButton({ children = "✕", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const context = useContext(ModalContext);
  const { onClick, "aria-label": ariaLabel, ...buttonProps } = props;

  return (
    <button
      type="button"
      aria-label={ariaLabel ?? "Fechar"}
      {...buttonProps}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) context?.onClose();
      }}
    >
      {children}
    </button>
  );
}

type ModalComponent = ((props: ModalProps) => ReactNode) & {
  Header: typeof ModalHeader;
  Body: typeof ModalBody;
  Footer: typeof ModalFooter;
  CloseButton: typeof ModalCloseButton;
};

function ModalComponent({
  open,
  isOpen,
  onClose,
  closeOnBackdrop = true,
  closeOnEscape = true,
  initialFocusRef,
  labelledBy,
  titleId,
  ariaLabel,
  "aria-label": ariaLabelProp,
  children,
  className = "",
}: ModalProps) {
  const active = open ?? isOpen ?? false;
  const dialogRef = useRef<HTMLDivElement>(null);
  const labelledById = labelledBy ?? titleId;
  const onCloseRef = useRef(onClose);
  const closeOnEscapeRef = useRef(closeOnEscape);
  const closeOnBackdropRef = useRef(closeOnBackdrop);
  const initialFocusRefRef = useRef(initialFocusRef);

  useEffect(() => {
    onCloseRef.current = onClose;
    closeOnEscapeRef.current = closeOnEscape;
    closeOnBackdropRef.current = closeOnBackdrop;
    initialFocusRefRef.current = initialFocusRef;
  }, [onClose, closeOnEscape, closeOnBackdrop, initialFocusRef]);

  const focusDialog = useCallback(() => {
    const target = initialFocusRefRef.current?.current;
    if (target) {
      target.focus();
      return;
    }
    const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    (firstFocusable ?? dialogRef.current)?.focus();
  }, []);

  useEffect(() => {
    if (!active) return;
    const entry: ModalEntry = {
      dialog: dialogRef.current,
      opener: typeof document !== "undefined" ? (document.activeElement as HTMLElement) : null,
    };
    modalStack.push(entry);
    lockBodyScroll();
    const timer = window.setTimeout(focusDialog, 0);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (modalStack[modalStack.length - 1] !== entry) return;
      if (event.key === "Escape" && closeOnEscapeRef.current) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = entry.dialog;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])',
        ),
      ).filter((element) => element.offsetParent !== null || element === document.activeElement);
      event.preventDefault();
      if (focusable.length === 0) {
        dialog.focus();
        return;
      }
      const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
      const nextIndex = event.shiftKey
        ? currentIndex <= 0
          ? focusable.length - 1
          : currentIndex - 1
        : currentIndex === focusable.length - 1
          ? 0
          : currentIndex + 1;
      focusable[nextIndex].focus();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", handleKeyDown);
      const wasTop = modalStack[modalStack.length - 1] === entry;
      const index = modalStack.indexOf(entry);
      if (index !== -1) modalStack.splice(index, 1);
      unlockBodyScroll();
      if (wasTop) {
        const nextTop = modalStack[modalStack.length - 1];
        if (nextTop?.dialog) nextTop.dialog.focus();
        else entry.opener?.focus();
      }
    };
  }, [active, focusDialog]);

  if (!active) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/80 backdrop-blur-sm p-4"
      onClick={(event) => {
        if (closeOnBackdropRef.current && event.target === event.currentTarget)
          onCloseRef.current();
      }}
    >
      <div className="flex min-h-full items-center justify-center">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledById}
          aria-label={ariaLabel ?? ariaLabelProp}
          tabIndex={-1}
          className={`flex min-h-0 max-h-[calc(100vh-2rem)] max-h-[calc(100dvh-2rem)] w-full flex-col ${className}`}
        >
          <ModalContext.Provider value={{ onClose }}>{children}</ModalContext.Provider>
        </div>
      </div>
    </div>
  );
}

export const Modal = ModalComponent as ModalComponent;
Modal.Header = ModalHeader;
Modal.Body = ModalBody;
Modal.Footer = ModalFooter;
Modal.CloseButton = ModalCloseButton;
