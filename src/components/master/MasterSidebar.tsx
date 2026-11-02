"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { Dices, Library, Globe2, Settings, ChevronLeft, ChevronRight } from "lucide-react";

const STORAGE_KEY = "libmork-master-sidebar-collapsed";

export function MasterSidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored !== null ? stored === "true" : false;
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  };

  const navItems = [
    {
      label: "Campanhas",
      href: "/master",
      Icon: Dices,
    },
    {
      label: "Biblioteca",
      href: "/master/library",
      Icon: Library,
    },
    {
      label: "Comunidade",
      href: "/master/community",
      Icon: Globe2,
    },
    {
      label: "Configurações",
      href: "/master/settings",
      Icon: Settings,
    },
  ];

  return (
    <aside
      className={`flex flex-col justify-between bg-dominant-deep border-r border-dominant-border text-secondary-offwhite transition-all duration-300 ${
        isCollapsed ? "w-16" : "w-64"
      }`}
    >
      <div className="flex flex-col">
        {/* Top Header & Toggle Button */}
        <div className="flex items-center justify-between p-4 border-b border-dominant-border">
          {!isCollapsed && (
            <span className="font-bold text-secondary-pure truncate">Área do Mestre</span>
          )}
          <button
            onClick={toggleCollapse}
            className="p-1.5 rounded hover:bg-dominant-container text-secondary-muted hover:text-secondary-pure transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ml-auto cursor-pointer"
            title={isCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
            aria-label={isCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
            aria-expanded={!isCollapsed}
            aria-controls="master-sidebar-nav"
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>

        {/* Navigation Links */}
        <nav id="master-sidebar-nav" className="flex flex-col gap-1 p-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.Icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                  isActive
                    ? "bg-accent/20 text-accent-hover border border-accent/40 font-medium"
                    : "hover:bg-dominant-container text-secondary-muted hover:text-secondary-pure"
                } ${isCollapsed ? "justify-center px-0" : ""}`}
                title={item.label}
                aria-label={item.label}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer / Logout */}
      <div className="p-4 border-t border-dominant-border flex items-center justify-center">
        {isCollapsed ? (
          <LogoutButton iconOnly={true} />
        ) : (
          <LogoutButton className="w-full flex items-center justify-center gap-2" />
        )}
      </div>
    </aside>
  );
}
