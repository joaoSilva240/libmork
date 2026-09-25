"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type WindowPortalProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  width?: number;
  height?: number;
  onBlocked?: () => void;
  children: ReactNode;
};

export function WindowPortal({
  isOpen,
  onClose,
  title = "Mesa — Libmork",
  width = 1280,
  height = 800,
  onBlocked,
  children,
}: WindowPortalProps) {
  const windowRef = useRef<Window | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [portalRoot, setPortalRoot] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (windowRef.current && !windowRef.current.closed) windowRef.current.close();
      windowRef.current = null;
      rootRef.current = null;
      setPortalRoot(null);
      return;
    }

    if (windowRef.current && !windowRef.current.closed && rootRef.current) {
      return;
    }

    const features = `popup=yes,width=${width},height=${height},noopener=no`;
    const externalWindow = window.open("", "libmork-mesa", features);
    if (!externalWindow || externalWindow.closed) {
      onBlocked?.();
      return;
    }

    windowRef.current = externalWindow;
    externalWindow.document.title = title;
    externalWindow.document.head.replaceChildren(
      ...Array.from(document.head.querySelectorAll("style, link[rel=stylesheet]")).map((node) => node.cloneNode(true)),
    );
    const root = externalWindow.document.createElement("div");
    root.id = "portal-root";
    root.className = "h-screen w-screen bg-gray-950 text-white overflow-hidden";
    externalWindow.document.body.replaceChildren(root);
    rootRef.current = root;
    setPortalRoot(root);

    const handleClose = () => onClose();
    externalWindow.addEventListener("beforeunload", handleClose);
    externalWindow.addEventListener("pagehide", handleClose);
    const timer = window.setInterval(() => {
      if (externalWindow.closed) onClose();
    }, 500);

    return () => {
      window.clearInterval(timer);
      externalWindow.removeEventListener("beforeunload", handleClose);
      externalWindow.removeEventListener("pagehide", handleClose);
      if (!externalWindow.closed) externalWindow.close();
      windowRef.current = null;
      rootRef.current = null;
    };
  }, [height, isOpen, onBlocked, onClose, title, width]);

  return portalRoot ? createPortal(children, portalRoot) : null;
}
