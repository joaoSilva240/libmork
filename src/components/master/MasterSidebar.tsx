"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/auth/LogoutButton";

const STORAGE_KEY = "libmork-master-sidebar-collapsed";

export function MasterSidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      setIsCollapsed(stored === "true");
    }
  }, []);

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
      icon: "🎲",
    },
    {
      label: "Biblioteca",
      href: "/master/library",
      icon: "📚",
    },
  ];

  return (
    <aside
      className={`flex flex-col justify-between bg-gray-950 border-r border-gray-800 text-gray-300 transition-all duration-300 ${
        isCollapsed ? "w-16" : "w-64"
      }`}
    >
      <div className="flex flex-col">
        {/* Top Header & Toggle Button */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          {!isCollapsed && (
            <span className="font-bold text-gray-100 truncate">
              Área do Mestre
            </span>
          )}
          <button
            onClick={toggleCollapse}
            className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-gray-100 transition-colors focus:outline-none ml-auto"
            title={isCollapsed ? "Expandir" : "Recolher"}
            aria-label={isCollapsed ? "Expandir sidebar" : "Recolher sidebar"}
          >
            {isCollapsed ? ">" : "<"}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex flex-col gap-1 p-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                  isActive
                    ? "bg-gray-800 text-white font-medium"
                    : "hover:bg-gray-900 text-gray-400 hover:text-gray-200"
                } ${isCollapsed ? "justify-center px-0" : ""}`}
                title={isCollapsed ? item.label : undefined}
              >
                <span className="text-xl leading-none">{item.icon}</span>
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer / Logout */}
      <div className="p-4 border-t border-gray-800 flex items-center justify-center">
        {isCollapsed ? (
          <LogoutButton iconOnly={true} />
        ) : (
          <LogoutButton className="w-full flex items-center justify-center gap-2" />
        )}
      </div>
    </aside>
  );
}
