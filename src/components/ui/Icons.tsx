"use client";

import React from "react";

export function StatusFilledIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      {/* User / Shield Filled Icon */}
      <path d="M12 2a5 5 0 100 10 5 5 0 000-10zM3.5 20.5a8.5 8.5 0 0117 0 .75.75 0 01-.75.75h-15.5a.75.75 0 01-.75-.75z" />
    </svg>
  );
}

export function SkillsFilledIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      {/* Book / Scroll Filled Icon */}
      <path d="M11.25 3.75A2.25 2.25 0 009 1.5H4.5A2.25 2.25 0 002.25 3.75v14.25A2.25 2.25 0 004.5 20.25H9a2.25 2.25 0 002.25-2.25V3.75zM12.75 3.75V18a2.25 2.25 0 002.25 2.25h4.5A2.25 2.25 0 0021.75 18V3.75A2.25 2.25 0 0019.5 1.5h-4.5a2.25 2.25 0 00-2.25 2.25z" />
    </svg>
  );
}

export function InventoryFilledIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      {/* Backpack / Briefcase / Archive Filled Icon */}
      <path d="M20 7h-4V5c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zM10 5h4v2h-4V5zm10 14H4v-8h16v8zm-7-6h-2v2h2v-2z" />
    </svg>
  );
}

export function SettingsFilledIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      {/* Settings / Gear Filled Icon */}
      <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.488.488 0 00-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
    </svg>
  );
}
