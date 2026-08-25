"use client";

import React from "react";

export function StatusFilledIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <span className={`font-dings text-[2.1rem] leading-none inline-flex items-center justify-center ${className}`}>J</span>
  );
}

export function SkillsFilledIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <span className={`font-dings text-[2.1rem] leading-none inline-flex items-center justify-center ${className}`}>L</span>
  );
}

export function InventoryFilledIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <span className={`font-dings text-[2.1rem] leading-none inline-flex items-center justify-center ${className}`}>T</span>
  );
}

export function SettingsFilledIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <span className={`font-dings text-[2.1rem] leading-none inline-flex items-center justify-center ${className}`}>E</span>
  );
}
