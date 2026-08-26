"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

interface LogoutButtonProps {
  iconOnly?: boolean;
  collapsed?: boolean;
  className?: string;
}

export function LogoutButton({ iconOnly, collapsed, className = "" }: LogoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const isIconOnly = iconOnly ?? collapsed ?? false;

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      window.location.href = "/login";
    } catch {
      setIsLoading(false);
    }
  };

  const defaultClasses = isIconOnly
    ? "p-2 font-medium"
    : "px-4 py-2 font-medium flex items-center justify-center gap-2";

  return (
    <Button
      onClick={handleLogout}
      disabled={isLoading}
      isLoading={isLoading}
      variant="danger"
      className={`${defaultClasses} ${className}`.trim()}
      title="Sair"
      aria-label="Sair"
    >
      {isIconOnly ? (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
          />
        </svg>
      ) : (
        <>
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          <span>Sair</span>
        </>
      )}
    </Button>
  );
}
