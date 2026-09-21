"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { BedIcon } from "@/components/ui/Icons";
import {
  RestType,
  REST_OPTIONS,
  calculateRest,
} from "@/lib/engine/rest";

export interface RestPopoverProps {
  currentHp: number;
  maxHp: number;
  currentMana: number;
  maxMana: number;
  vigor: number;
  onSelectRest: (restType: RestType) => Promise<void> | void;
  disabled?: boolean;
}

const REST_TYPE_LIST: RestType[] = ["precarious", "mediocre", "comfortable", "luxurious"];

export function RestPopover({
  currentHp,
  maxHp,
  currentMana,
  maxMana,
  vigor,
  onSelectRest,
  disabled = false,
}: RestPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = () => {
    if (triggerButtonRef.current) {
      const rect = triggerButtonRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 8,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    }
  };

  // Close on outside click, window resize/scroll, and Escape key
  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        triggerButtonRef.current &&
        !triggerButtonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerButtonRef.current?.focus();
      }
    }

    function handleScrollOrResize() {
      updatePosition();
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleScrollOrResize);
    window.addEventListener("scroll", handleScrollOrResize, true);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("scroll", handleScrollOrResize, true);
    };
  }, [isOpen]);

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen((prev) => !prev);
  };

  const handleRestSelect = async (restType: RestType) => {
    if (disabled) return;
    setIsOpen(false);
    await onSelectRest(restType);
  };

  return (
    <div className="relative inline-block text-left">
      <button
        ref={triggerButtonRef}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        aria-label="Descansar personagem"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="inline-flex items-center justify-center p-2 rounded-lg border border-gray-700/80 bg-gray-800/80 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <BedIcon className="w-5 h-5" />
      </button>

      {isOpen && mounted && typeof document !== "undefined" &&
        createPortal(
          <>
            {/* Backdrop para capturar cliques fora e evitar cortes em qualquer layout pai */}
            <div
              className="fixed inset-0 z-40 bg-black/40 md:bg-transparent"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />

            <div
              ref={popoverRef}
              role="menu"
              aria-orientation="vertical"
              style={{
                top: `${coords.top}px`,
                right: `${coords.right}px`,
              }}
              className="fixed w-72 origin-top-right rounded-lg border border-gray-700/80 bg-gray-900/95 shadow-xl backdrop-blur-sm z-50 p-2 space-y-1 focus:outline-none max-w-[calc(100vw-1rem)]"
            >
              <div className="px-3 py-1.5 border-b border-gray-800 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Escolha o tipo de descanso
              </div>

              {REST_TYPE_LIST.map((restType) => {
                const config = REST_OPTIONS[restType];
                const result = calculateRest({
                  currentHp,
                  maxHp,
                  currentMana,
                  maxMana,
                  vigor,
                  restType,
                });

                const isFullyRestored =
                  result.hpRecovered === 0 &&
                  result.manaRecovered === 0 &&
                  currentHp === maxHp &&
                  currentMana === maxMana;

                const recoveryPreview = isFullyRestored
                  ? "HP e MP cheios"
                  : `+${result.hpRecovered} HP, +${result.manaRecovered} MP`;

                return (
                  <button
                    key={restType}
                    role="menuitem"
                    type="button"
                    disabled={disabled}
                    onClick={() => handleRestSelect(restType)}
                    className="w-full text-left px-3 py-2 rounded-md transition-colors hover:bg-purple-950/40 focus:bg-purple-950/50 focus:outline-none focus:ring-1 focus:ring-purple-500 group disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-200 group-hover:text-purple-300">
                        {config.label}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700">
                        {config.fractionLabel}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs">
                      <span className="text-emerald-400 font-medium">
                        {recoveryPreview}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
