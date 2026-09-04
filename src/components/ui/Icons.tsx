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

export function CharactersFilledIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <span className={`font-dings text-[2.1rem] leading-none inline-flex items-center justify-center ${className}`}>U</span>
  );
}

export function CampaignsFilledIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <span className={`font-dings text-[2.1rem] leading-none inline-flex items-center justify-center ${className}`}>O</span>
  );
}

export function SpellFilledIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`font-dings text-[2.1rem] leading-none inline-flex items-center justify-center ${className}`}>
      P
    </span>
  );
}

export function ArrowLeftIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
    </svg>
  );
}

export function LogOutIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
      />
    </svg>
  );
}
